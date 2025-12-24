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
        :class="{ 'is-reordering': isDropTarget && isDragging }"
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
            <!-- Placeholder item -->
            <div
              v-if="item.isPlaceholder"
              class="placeholder-wrapper"
              :style="{ height: `${placeholderHeight}px` }"
            >
              <div class="placeholder-inner"></div>
            </div>

            <!-- Real task item -->
            <div
              v-else
              class="task-wrapper"
              :class="{
                'dragged-original': isSourceTask(item.id),
              }"
              :data-task-id="item.id"
              @dragover.prevent.stop="handleTaskDragOver($event, item)"
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

      <!-- Empty column UI (only when truly empty and not showing placeholder) -->
      <div
        v-if="column.tasks.length === 0 && !isDropTarget"
        class="empty-state"
      >
        <span class="empty-icon">📋</span>
        <span>Drop tasks here</span>
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

// Hysteresis to prevent index flip-flopping near a task midpoint
const MIDPOINT_HYSTERESIS = 20;

// Throttle for drag updates (~60fps)
const DRAG_UPDATE_THROTTLE = 16;

// Track last computed index to prevent toggling
const lastComputedIndex = ref(null);

const props = defineProps({
  column: { type: Object, required: true },
});

const emit = defineEmits(["task-move"]);

const dragDrop = inject("kanbanDragDrop");

const scrollerRef = ref(null);
const tasksContainerRef = ref(null);

const lastDropUpdate = ref(0);

// =====================
// COMPUTED HELPERS
// =====================
const isDragging = computed(() => !!dragDrop?.isDragging?.value);

const isDropTarget = computed(() => {
  return isDragging.value && dragDrop?.dropTargetColumnId?.value === props.column.id;
});

const draggedTaskId = computed(() => dragDrop?.draggedTask?.value?.id || null);

const placeholderHeight = computed(() => {
  return dragDrop?.placeholderHeight?.value || MIN_ITEM_SIZE;
});

// Map task ID -> original index in column.tasks
const originalIndexById = computed(() => {
  const map = Object.create(null);
  for (let i = 0; i < props.column.tasks.length; i++) {
    map[props.column.tasks[i].id] = i;
  }
  return map;
});

// =====================
// RENDER ITEMS (stable placeholder)
// =====================
const renderItems = computed(() => {
  const tasks = props.column.tasks;
  if (!isDragging.value || !draggedTaskId.value) return tasks;

  const srcCol = dragDrop.sourceColumnId.value;
  const tgtCol = dragDrop.dropTargetColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;
  const tgtIdx = dragDrop.dropTargetIndex.value;
  const dragId = draggedTaskId.value;

  // SAME COLUMN: remove dragged task and insert placeholder
  if (srcCol === props.column.id && tgtCol === props.column.id) {
    const filtered = tasks.filter(t => t.id !== dragId);

    const insertAt = Math.max(0, Math.min(tgtIdx ?? 0, filtered.length));
    const result = [...filtered];
    result.splice(insertAt, 0, {
      id: `__placeholder__${props.column.id}`,
      isPlaceholder: true
    });
    return result;
  }

  // SOURCE column in cross-column drag: hide dragged task
  if (srcCol === props.column.id && tgtCol !== props.column.id) {
    return tasks.filter(t => t.id !== dragId);
  }

  // TARGET column in cross-column drag: insert placeholder at target index
  if (tgtCol === props.column.id && srcCol !== props.column.id) {
    const insertAt = Math.max(0, Math.min(tgtIdx ?? 0, tasks.length));
    const result = [...tasks];
    result.splice(insertAt, 0, {
      id: `__placeholder__${props.column.id}`,
      isPlaceholder: true
    });
    return result;
  }

  return tasks;
});

function getSizeDeps(item) {
  if (item?.isPlaceholder) return [placeholderHeight.value];
  return [item.title, item.description, item.priority];
}

// =====================
// SOURCE TASK (hide original)
// =====================
const isSourceTask = (taskId) => {
  if (!isDragging.value || !draggedTaskId.value) return false;
  return (
    dragDrop.sourceColumnId.value === props.column.id &&
    taskId === draggedTaskId.value
  );
};

// =====================
// DROP INDEX CALCULATION (stable)
// =====================

function computeDropIndexOverTask(event, hoveredTask) {
  const hoveredOriginalIndex = originalIndexById.value[hoveredTask.id];
  if (hoveredOriginalIndex === undefined) return 0;

  const rect = event.currentTarget.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const y = event.clientY;

  const srcCol = dragDrop.sourceColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;

  // DEAD ZONE: do not flip index when near midpoint
  const inDeadZone = y >= (midpoint - MIDPOINT_HYSTERESIS) && y <= (midpoint + MIDPOINT_HYSTERESIS);

  // Determine before/after unless in dead zone
  let insertAfter;
  if (inDeadZone) {
    // Stay with last computed index if we're in the dead zone
    if (lastComputedIndex.value !== null && dragDrop.dropTargetColumnId.value === props.column.id) {
      return lastComputedIndex.value;
    }
    insertAfter = false;
  } else {
    insertAfter = y > midpoint;
  }

  // === SAME COLUMN ===
  if (srcCol === props.column.id) {
    // We compute indices in "filtered space" (dragged item removed), because renderItems uses that.
    let resultIndex;
    if (hoveredOriginalIndex < srcIdx) {
      resultIndex = insertAfter ? hoveredOriginalIndex + 1 : hoveredOriginalIndex;
    } else if (hoveredOriginalIndex > srcIdx) {
      const filteredIdx = hoveredOriginalIndex - 1;
      resultIndex = insertAfter ? filteredIdx + 1 : filteredIdx;
    } else {
      // hovering original dragged position; keep current
      resultIndex = dragDrop.dropTargetIndex.value ?? srcIdx;
    }
    lastComputedIndex.value = resultIndex;
    return resultIndex;
  }

  // === DIFFERENT COLUMN ===
  const targetIdx = insertAfter ? hoveredOriginalIndex + 1 : hoveredOriginalIndex;
  const resultIndex = Math.max(0, Math.min(targetIdx, props.column.tasks.length));
  lastComputedIndex.value = resultIndex;
  return resultIndex;
}

function computeDropIndexInEmptySpace(event) {
  const container = tasksContainerRef.value;
  if (!container) return props.column.tasks.length;

  const wrappers = Array.from(
    container.querySelectorAll(".task-wrapper[data-task-id]")
  );

  if (wrappers.length === 0) {
    return 0;
  }

  const y = event.clientY;
  const srcCol = dragDrop.sourceColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;

  // Default: insert at end
  let insertIndex = props.column.tasks.length;

  for (const el of wrappers) {
    const taskId = el.getAttribute("data-task-id");
    const originalIdx = originalIndexById.value[taskId];
    if (originalIdx === undefined) continue;

    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (y < mid) {
      // Same column: convert to filtered space
      if (srcCol === props.column.id) {
        insertIndex = originalIdx < srcIdx ? originalIdx : (originalIdx - 1);
      } else {
        insertIndex = originalIdx;
      }
      break;
    }
  }

  const maxIdx = srcCol === props.column.id
    ? Math.max(0, props.column.tasks.length - 1)
    : props.column.tasks.length;

  return Math.max(0, Math.min(insertIndex, maxIdx));
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

  const originalIndex = originalIndexById.value[task.id];
  dragDrop.handleDragStart(event, task, props.column.id, originalIndex, element);
};

const handleTaskDragEnd = () => {
  dragDrop.handleDragEnd();
  lastComputedIndex.value = null;
};

const handleTaskDragOver = (event, hoveredTask) => {
  if (!draggedTaskId.value) return;
  event.stopPropagation();

  const now = Date.now();
  if (now - lastDropUpdate.value < DRAG_UPDATE_THROTTLE) return;
  lastDropUpdate.value = now;

  const idx = computeDropIndexOverTask(event, hoveredTask);
  dragDrop.handleDragOver(event, props.column.id, idx);
};

const handleColumnDragOver = (event) => {
  if (!draggedTaskId.value) return;

  const now = Date.now();
  if (now - lastDropUpdate.value < DRAG_UPDATE_THROTTLE) return;
  lastDropUpdate.value = now;

  const idx = computeDropIndexInEmptySpace(event);
  dragDrop.handleDragOver(event, props.column.id, idx);
};

const handleColumnDrop = (event) => {
  dragDrop.handleColumnDrop(event, props.column.id, (moveData) => {
    emit("task-move", moveData);
  });
};

// Escape to cancel
let escapeHandler = null;

onMounted(() => {
  escapeHandler = (e) => {
    if (e.key === "Escape" && draggedTaskId.value) {
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
  background: #181921;
  border-radius: 7px;
  padding: 8px;
  width: 400px;
  min-width: 400px;
  max-width: 400px;
  border: 1px solid rgba(255, 255, 255, 0.05);
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
  padding: 4px 6px;
}

.column-header h2 {
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
  margin: 0;
}

.task-count {
  color: #94a3b8;
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

/* Professional scrollbar styling */
.tasks-scroller::-webkit-scrollbar {
  width: 8px;
}

.tasks-scroller::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  margin: 4px 0;
}

.tasks-scroller::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.tasks-scroller::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tasks-scroller::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.25);
}

/* Firefox scrollbar styling */
.tasks-scroller {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) rgba(255, 255, 255, 0.02);
}

/* Smooth reflow when placeholder index changes */
.tasks-scroller.is-reordering :deep(.vue-recycle-scroller__item-view) {
  transition: transform 140ms cubic-bezier(0.4, 0, 0.2, 1);
}

.task-wrapper {
  padding: 4px 6px;
  will-change: transform;
}

/* Hide the original dragged card without animating opacity (prevents "blink") */
.task-wrapper.dragged-original {
  opacity: 0;
}

.placeholder-wrapper {
  padding: 4px 6px;
  pointer-events: none;
}

.placeholder-inner {
  height: 100%;
  border: 2px dashed rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 120px;
  color: rgba(148, 163, 184, 0.9);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  margin: 8px 6px;
}
</style>