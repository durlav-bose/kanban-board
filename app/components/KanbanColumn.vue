<template>
  <div
    class="task-column"
    :data-column="column.id"
    :class="{ 'column-drag-over': isDropTarget }"
    @dragover.prevent="handleColumnDragOver"
    @drop.prevent="handleColumnDrop"
  >
    <div class="column-header">
      <h2>{{ column.title }}</h2>
      <span class="task-count">{{ column.tasks.length }}</span>
    </div>

    <div class="tasks-container" ref="tasksContainerRef">
      <DynamicScroller
        ref="scrollerRef"
        class="tasks-scroller"
        :items="renderItems"
        :min-item-size="MIN_ITEM_SIZE"
        key-field="id"
        :buffer="200"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :size-dependencies="getSizeDeps(item)"
            :data-index="index"
          >
            <!-- PLACEHOLDER ITEM (real list item) -->
            <div
              v-if="item.isPlaceholder"
              class="task-wrapper placeholder-wrapper"
              :style="{ height: `${placeholderHeight}px` }"
              data-placeholder="true"
            >
              <div class="floating-placeholder">
                <div class="placeholder-inner"></div>
              </div>
            </div>

            <!-- REAL TASK ITEM -->
            <div
              v-else
              class="task-wrapper"
              :data-task-id="item.id"
              :data-task-index="taskIndexById[item.id]"
              @dragover.prevent.stop="handleTaskDragOver($event, item.id)"
            >
              <KanbanTask
                :task="item"
                @dragstart="handleTaskDragStart($event, item)"
                @dragend="handleTaskDragEnd"
              />
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>

      <!-- Empty column drop zone -->
      <div
        v-if="column.tasks.length === 0"
        class="empty-drop-zone"
        @dragover.prevent="handleEmptyColumnDragOver"
      >
        <div v-if="isDropTarget" class="empty-placeholder">
          <div class="placeholder-inner"></div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📋</span>
          <span>Drop tasks here</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, onMounted, onUnmounted } from "vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import KanbanTask from "./KanbanTask.vue";

const MIN_ITEM_SIZE = 80;

const props = defineProps({
  column: { type: Object, required: true },
});

const emit = defineEmits(["task-move"]);

const dragDrop = inject("kanbanDragDrop");

const scrollerRef = ref(null);
const tasksContainerRef = ref(null);

// Small throttle to reduce jitter in very tall items
const lastDropUpdate = ref(0);
const DRAG_UPDATE_THROTTLE = 16;

// =====================
// DERIVED / COMPUTED
// =====================

const isDropTarget = computed(() => {
  return (
    !!dragDrop?.draggedTask?.value &&
    dragDrop.dropTargetColumnId.value === props.column.id
  );
});

const isSameColumn = computed(() => {
  return dragDrop?.sourceColumnId?.value === props.column.id;
});

const draggedTaskId = computed(() => dragDrop?.draggedTask?.value?.id || null);

const taskIndexById = computed(() => {
  const map = Object.create(null);
  for (let i = 0; i < props.column.tasks.length; i++) {
    map[props.column.tasks[i].id] = i;
  }
  return map;
});

// Info needed to decide whether placeholder is shown in this column
const placeholderInfo = computed(() => {
  if (!draggedTaskId.value) return null;
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
  if (dragDrop.dropTargetIndex.value === null || dragDrop.dropTargetIndex.value === undefined) return null;

  const dropIdx = dragDrop.dropTargetIndex.value;
  const srcIdx = dragDrop.sourceIndex.value;
  const same = isSameColumn.value;

  // In same column: if drop target equals source position, no placeholder needed
  if (same && typeof srcIdx === "number" && dropIdx === srcIdx) return null;

  return {
    dropIndexRaw: dropIdx,         // might be in original index space
    sourceIndex: srcIdx,
    isSameColumn: same,
  };
});

// The placeholder’s visual height
const placeholderHeight = computed(() => {
  // Prefer the height captured on dragStart
  const h = dragDrop?.placeholderHeight?.value;
  if (h && Number(h) > 0) return Number(h);

  return MIN_ITEM_SIZE;
});

// Build the list that the scroller will render
// This is the key to “perfect linear”.
const renderItems = computed(() => {
  const base = props.column.tasks || [];
  const info = placeholderInfo.value;

  // no active placeholder for this column
  if (!info) return base;

  const srcId = draggedTaskId.value;

  // Build list in “without dragged” space if same column
  let list = base.slice();
  if (info.isSameColumn && srcId) {
    list = list.filter((t) => t.id !== srcId);
  }

  // Clamp index in this list’s coordinate space
  // IMPORTANT: dropTargetIndex should already be “without dragged” for same-column,
  // BUT many implementations store it in original space.
  // We normalize here:
  let dropIndex = info.dropIndexRaw;

  if (
    info.isSameColumn &&
    typeof info.sourceIndex === "number" &&
    dropIndex > info.sourceIndex
  ) {
    dropIndex = dropIndex - 1;
  }

  dropIndex = Math.max(0, Math.min(dropIndex, list.length));

  const placeholderId = `__placeholder__:${props.column.id}`;

  list.splice(dropIndex, 0, {
    id: placeholderId,
    isPlaceholder: true,
  });

  return list;
});

function getSizeDeps(item) {
  if (item?.isPlaceholder) return [placeholderHeight.value];
  return [item.title, item.description, item.priority];
}

// =====================
// DROP INDEX CALCULATION
// =====================

// Convert hover over a specific task into an insertion index
function computeDropIndexOverTask(event, hoveredTaskId) {
  const hoveredIndex = taskIndexById.value[hoveredTaskId];

  if (typeof hoveredIndex !== "number") return 0;

  const wrapper = event.currentTarget;
  const rect = wrapper.getBoundingClientRect();

  const mouseY = event.clientY;
  const mid = rect.top + rect.height / 2;

  let raw = mouseY < mid ? hoveredIndex : hoveredIndex + 1;

  // Normalize for same-column “without dragged” space
  if (
    isSameColumn.value &&
    typeof dragDrop.sourceIndex.value === "number" &&
    raw > dragDrop.sourceIndex.value
  ) {
    raw = raw - 1;
  }

  // Clamp in target list length (without dragged if same column)
  const baseLen = props.column.tasks.length;
  const withoutDraggedLen =
    isSameColumn.value && draggedTaskId.value
      ? baseLen - 1
      : baseLen;

  return Math.max(0, Math.min(raw, withoutDraggedLen));
}

// Convert “column empty space” hover into insertion index
function computeDropIndexInColumn(event) {
  const container = tasksContainerRef.value;
  if (!container) return 0;

  const wrappers = Array.from(container.querySelectorAll(".task-wrapper[data-task-id]"));

  // If no rendered tasks, it’s index 0
  if (wrappers.length === 0) return 0;

  const mouseY = event.clientY;

  // Find first wrapper whose midpoint is below mouse
  let insertIndex = props.column.tasks.length;

  for (const el of wrappers) {
    const rect = el.getBoundingClientRect();
    const id = el.getAttribute("data-task-id");
    const idx = taskIndexById.value[id];

    if (typeof idx !== "number") continue;

    const mid = rect.top + rect.height / 2;

    if (mouseY < mid) {
      insertIndex = idx;
      break;
    }
  }

  // Normalize for same-column without-dragged space
  if (
    isSameColumn.value &&
    typeof dragDrop.sourceIndex.value === "number" &&
    insertIndex > dragDrop.sourceIndex.value
  ) {
    insertIndex = insertIndex - 1;
  }

  const baseLen = props.column.tasks.length;
  const withoutDraggedLen =
    isSameColumn.value && draggedTaskId.value
      ? baseLen - 1
      : baseLen;

  return Math.max(0, Math.min(insertIndex, withoutDraggedLen));
}

// =====================
// EVENT HANDLERS
// =====================

const handleTaskDragStart = (event, task) => {
  const element = event.target?.closest?.('[draggable="true"]');
  if (!element) {
    event.preventDefault();
    return;
  }

  // Capture height immediately for placeholder sizing
  // (your composable should store this)
  dragDrop.handleDragStart(event, task, props.column.id, taskIndexById.value[task.id], element);
};

const handleTaskDragEnd = () => {
  dragDrop.handleDragEnd();
};

const handleTaskDragOver = (event, hoveredTaskId) => {
  if (!draggedTaskId.value) return;
  event.stopPropagation();

  const now = Date.now();
  if (now - lastDropUpdate.value < DRAG_UPDATE_THROTTLE) return;

  const idx = computeDropIndexOverTask(event, hoveredTaskId);

  // Prefer composable API if available
  if (typeof dragDrop.handleDragOver === "function") {
    dragDrop.handleDragOver(event, props.column.id, idx);
  } else {
    dragDrop.dropTargetColumnId.value = props.column.id;
    dragDrop.dropTargetIndex.value = idx;
  }

  lastDropUpdate.value = now;
};

const handleColumnDragOver = (event) => {
  if (!draggedTaskId.value) return;

  const idx = computeDropIndexInColumn(event);

  dragDrop.dropTargetColumnId.value = props.column.id;
  dragDrop.dropTargetIndex.value = idx;
};

const handleEmptyColumnDragOver = (event) => {
  if (!draggedTaskId.value) return;
  event.preventDefault();

  dragDrop.dropTargetColumnId.value = props.column.id;
  dragDrop.dropTargetIndex.value = 0;
};

const handleColumnDrop = (event) => {
  dragDrop.handleDrop(event, props.column.id, (moveData) => {
    emit("task-move", moveData);
  });
};

// Escape to cancel
let escapeHandler = null;

onMounted(() => {
  escapeHandler = (e) => {
    if (e.key === "Escape" && draggedTaskId.value && typeof dragDrop.resetDragState === "function") {
      dragDrop.resetDragState();
    }
  };
  window.addEventListener("keydown", escapeHandler);
});

onUnmounted(() => {
  if (escapeHandler) window.removeEventListener("keydown", escapeHandler);
});

defineExpose({ scrollerRef });
</script>

<style scoped>
.task-column {
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(71, 85, 105, 0.5);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.task-column.column-drag-over {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(71, 85, 105, 0.5);
  flex-shrink: 0;
}

.column-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}

.task-count {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tasks-container {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.tasks-scroller {
  height: 100%;
  overflow-y: auto !important;
  overflow-x: hidden;
}

.task-wrapper {
  padding: 4px 6px;
}

/* Placeholder item wrapper: reserve space naturally via real height */
.placeholder-wrapper {
  pointer-events: none;
}

/* Visual placeholder */
.floating-placeholder {
  height: 100%;
  border: 2px dashed rgba(99, 102, 241, 0.8);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.15);
  overflow: hidden;
  position: relative;
}

.placeholder-inner {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(99, 102, 241, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Empty column */
.empty-drop-zone {
  flex: 1;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-placeholder {
  width: 100%;
  height: 80px;
  border: 2px dashed rgba(99, 102, 241, 0.8);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  position: relative;
  overflow: hidden;
}

.empty-state {
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.empty-icon {
  font-size: 1.5rem;
  opacity: 0.5;
}
</style>
