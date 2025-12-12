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
      <!-- Floating placeholder lives in tasks-container (overlay), but we position it
           using task wrapper DOM rects which already reflect scroller scroll. -->
      <div
        v-if="showPlaceholder"
        class="floating-placeholder"
        :style="placeholderStyle"
      >
        <div class="placeholder-inner"></div>
      </div>

      <DynamicScroller
        ref="scrollerRef"
        class="tasks-scroller"
        :items="column.tasks"
        :min-item-size="MIN_ITEM_SIZE"
        key-field="id"
        :buffer="200"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :size-dependencies="[item.title, item.description, item.priority]"
            :data-index="index"
          >
            <div
              class="task-wrapper"
              :class="{
                'is-dragging-source': isSourceTask(item.id, index),
                [getShiftClass(index)]: true
              }"
              :style="getShiftStyle(index)"
              :data-task-index="index"
              :data-task-id="item.id"
              @dragover.prevent.stop="handleTaskDragOver($event, index)"
            >
              <KanbanTask
                :task="item"
                @dragstart="handleTaskDragStart($event, item, index)"
                @dragend="handleTaskDragEnd"
              />
            </div>
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
    </div>

    <div
      v-if="column.tasks.length === 0"
      class="empty-drop-zone"
      @dragover.prevent="handleEmptyColumnDragOver"
    >
      <div
        v-if="dragDrop.isDragging.value && dragDrop.dropTargetColumnId.value === column.id"
        class="empty-placeholder"
      >
        <div class="placeholder-inner"></div>
      </div>
      <div v-else class="empty-state">
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

// Constants
const MIN_ITEM_SIZE = 80;

const props = defineProps({
  column: { type: Object, required: true },
});

const emit = defineEmits(["task-move"]);

const dragDrop = inject("kanbanDragDrop");

const scrollerRef = ref(null);
const tasksContainerRef = ref(null);

// Anti-shake throttle (your existing approach)
const lastDropUpdate = ref(0);
const DRAG_UPDATE_THROTTLE = 16; // ~60fps

// ============ COMPUTED STATE ============
const isDropTarget = computed(() => {
  return (
    dragDrop.isDragging.value &&
    dragDrop.dropTargetColumnId.value === props.column.id
  );
});

// Is this the SOURCE task being dragged?
const isSourceTask = (taskId, index) => {
  if (!dragDrop.isDragging.value) return false;
  if (!dragDrop.draggedTask.value) return false;

  return (
    dragDrop.sourceColumnId.value === props.column.id &&
    dragDrop.sourceIndex.value === index &&
    dragDrop.draggedTask.value.id === taskId
  );
};

// ============ PLACEHOLDER LOGIC ============
const placeholderInfo = computed(() => {
  if (!dragDrop.isDragging.value) return null;
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
  if (dragDrop.dropTargetIndex.value === null) return null;

  const dropIdx = dragDrop.dropTargetIndex.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id;

  // Same column: don't show placeholder at source position
  if (isSameColumn && dropIdx === sourceIdx) return null;

  return {
    dropIndex: dropIdx,
    isSameColumn,
    sourceIndex: sourceIdx,
  };
});

const showPlaceholder = computed(() => placeholderInfo.value !== null);

// ============ PLACEHOLDER POSITIONING (SCROLL-SAFE + VIRTUAL-SCROLLER-SAFE) ============
const placeholderStyle = computed(() => {
  if (!placeholderInfo.value || !tasksContainerRef.value) {
    return { display: "none" };
  }

  const { dropIndex, isSameColumn, sourceIndex } = placeholderInfo.value;

  const containerEl = tasksContainerRef.value;
  const containerRect = containerEl.getBoundingClientRect();

  // Grab rendered wrappers only (virtual scroller renders a subset; that's fine)
  const wrappers = Array.from(
    containerEl.querySelectorAll(".task-wrapper[data-task-index]")
  );

  // 1) Determine placeholder height
  let height = MIN_ITEM_SIZE;

  if (isSameColumn) {
    const sourceEl = wrappers.find(
      (w) => parseInt(w.dataset.taskIndex || "-1", 10) === sourceIndex
    );
    if (sourceEl) height = sourceEl.offsetHeight || MIN_ITEM_SIZE;
  } else {
    height = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
  }

  // 2) Determine placeholder TOP using rendered element rects (scroll-safe)
  // We try to place it:
  // - Before the element whose index == dropIndex (if rendered)
  // - Otherwise after the last rendered element
  // - If nothing rendered, top = 0
  let top = 0;

  if (wrappers.length === 0) {
    top = 0;
  } else {
    // Sort wrappers by index for stable behavior
    wrappers.sort(
      (a, b) =>
        parseInt(a.dataset.taskIndex || "0", 10) -
        parseInt(b.dataset.taskIndex || "0", 10)
    );

    const beforeEl = wrappers.find(
      (w) => parseInt(w.dataset.taskIndex || "-1", 10) === dropIndex
    );

    console.log('beforeEl :>> ', beforeEl);

    if (beforeEl) {
      const r = beforeEl.getBoundingClientRect();
      console.log('r.top :>> ', r.top);
      console.log('containerRect.top :>> ', containerRect.top);
      top = r.top - containerRect.top;
      console.log('top :>> ', top);
    } else {
      const last = wrappers[wrappers.length - 1];
      const r = last.getBoundingClientRect();
      top = r.bottom - containerRect.top;
      console.log('top :>> ', top);
    }
  }

  // Clamp to avoid negative top in edge cases
  top = Math.max(0, top);

  return {
    top: `${top}px`,
    height: `${height}px`,
  };
});

// ============ SHIFTING LOGIC (UNCHANGED) ============
const getShiftDirection = (index) => {
  if (!dragDrop.isDragging.value) return null;

  const sourceCol = dragDrop.sourceColumnId.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const targetCol = dragDrop.dropTargetColumnId.value;
  const thisCol = props.column.id;

  // SOURCE column behavior
  if (thisCol === sourceCol) {
    if (!placeholderInfo.value) {
      if (index > sourceIdx) return "up";
      return null;
    }

    const { dropIndex } = placeholderInfo.value;

    if (index === sourceIdx) return null;

    if (dropIndex < sourceIdx) {
      if (index >= dropIndex && index < sourceIdx) return "down";
      return null;
    } else if (dropIndex > sourceIdx) {
      if (index > sourceIdx && index < dropIndex) return "up";
      return null;
    }
    return null;
  }

  // TARGET column behavior
  if (thisCol === targetCol && placeholderInfo.value) {
    const { dropIndex } = placeholderInfo.value;
    if (index >= dropIndex) return "down";
  }

  return null;
};

const getShiftClass = (index) => {
  const direction = getShiftDirection(index);
  if (direction === "down") return "is-shifted";
  if (direction === "up") return "is-shifted-up";
  return "";
};

const getShiftStyle = (index) => {
  const direction = getShiftDirection(index);
  if (!direction) return {};

  const sourceCol = dragDrop.sourceColumnId.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const thisCol = props.column.id;

  const wrappers =
    tasksContainerRef.value?.querySelectorAll(".task-wrapper") || [];

  let shiftAmount = MIN_ITEM_SIZE;

  if (thisCol === sourceCol) {
    const sourceEl = Array.from(wrappers).find(
      (w) => parseInt(w.dataset.taskIndex || "-1", 10) === sourceIdx
    );
    shiftAmount = sourceEl?.offsetHeight || MIN_ITEM_SIZE;
  } else {
    shiftAmount = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
  }

  if (direction === "up") return { transform: `translateY(-${shiftAmount}px)` };
  if (direction === "down") return { transform: `translateY(${shiftAmount}px)` };

  return {};
};

// ============ EVENT HANDLERS ============
const handleTaskDragStart = (event, task, index) => {
  const element = event.target.closest('[draggable="true"]');
  if (!element) {
    event.preventDefault();
    return;
  }
  dragDrop.handleDragStart(event, task, props.column.id, index, element);
};

const handleTaskDragEnd = () => {
  dragDrop.handleDragEnd();
};

const handleTaskDragOver = (event, index) => {
  if (!dragDrop.isDragging.value) return;
  event.stopPropagation();

  const now = Date.now();
  if (now - lastDropUpdate.value < DRAG_UPDATE_THROTTLE) return;

  const wrapper = event.currentTarget;
  const rect = wrapper.getBoundingClientRect();
  const mouseY = event.clientY;

  const elementHeight = rect.height || 1;
  const relativeY = mouseY - rect.top;
  const percentY = relativeY / elementHeight;

  let dropIndex;
  const currentDropIndex = dragDrop.dropTargetIndex.value;
  const currentIsAbove = currentDropIndex === index;
  const currentIsBelow = currentDropIndex === index + 1;

  if (currentIsAbove) {
    dropIndex = percentY > 0.6 ? index + 1 : index;
  } else if (currentIsBelow) {
    dropIndex = percentY < 0.4 ? index : index + 1;
  } else {
    dropIndex = percentY < 0.5 ? index : index + 1;
  }

  if (dropIndex !== dragDrop.dropTargetIndex.value) {
    lastDropUpdate.value = now;
    dragDrop.handleDragOver(event, props.column.id, dropIndex);
  }
};

const handleColumnDragOver = (event) => {
  if (!dragDrop.isDragging.value) return;
  event.preventDefault();

  const mouseY = event.clientY;
  const container = tasksContainerRef.value;
  if (!container) return;

  const wrappers = Array.from(
    container.querySelectorAll(".task-wrapper[data-task-index]")
  );

  if (wrappers.length === 0) {
    dragDrop.dropTargetColumnId.value = props.column.id;
    dragDrop.dropTargetIndex.value = 0;
    return;
  }

  // Sort by index for consistency
  wrappers.sort(
    (a, b) =>
      parseInt(a.dataset.taskIndex || "0", 10) -
      parseInt(b.dataset.taskIndex || "0", 10)
  );

  let insertIndex = props.column.tasks.length;

  for (const w of wrappers) {
    const rect = w.getBoundingClientRect();
    if (rect.height === 0) continue;

    const taskIndex = parseInt(w.dataset.taskIndex || "0", 10);
    const middle = rect.top + rect.height / 2;

    if (mouseY < middle) {
      insertIndex = taskIndex;
      break;
    }
  }

  dragDrop.dropTargetColumnId.value = props.column.id;
  dragDrop.dropTargetIndex.value = insertIndex;
};

const handleColumnDrop = (event) => {
  dragDrop.handleDrop(event, props.column.id, (moveData) => {
    emit("task-move", moveData);
  });
};

const handleEmptyColumnDragOver = (event) => {
  if (!dragDrop.isDragging.value) return;
  event.preventDefault();
  dragDrop.dropTargetColumnId.value = props.column.id;
  dragDrop.dropTargetIndex.value = 0;
};

// ============ LIFECYCLE ============
let escapeHandler = null;

onMounted(() => {
  escapeHandler = (e) => {
    if (e.key === "Escape" && dragDrop.isDragging.value) {
      dragDrop.resetDragState();
    }
  };
  window.addEventListener("keydown", escapeHandler);
});

onUnmounted(() => {
  if (escapeHandler) {
    window.removeEventListener("keydown", escapeHandler);
  }
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

/* Tasks container */
.tasks-container {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

/* Scroller */
.tasks-scroller {
  height: 100%;
  overflow-y: auto !important;
  overflow-x: hidden;
  position: relative;
}

/* Scrollbar styling */
.tasks-scroller::-webkit-scrollbar {
  width: 8px;
}
.tasks-scroller::-webkit-scrollbar-track {
  background: rgba(71, 85, 105, 0.2);
  border-radius: 4px;
}
.tasks-scroller::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.6);
  border-radius: 4px;
}
.tasks-scroller::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 0.8);
}

/* Task wrapper */
.task-wrapper {
  padding: 4px 6px;
  transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease;
  will-change: transform;
  position: relative;
}

/* Source task invisible */
.task-wrapper.is-dragging-source {
  opacity: 0;
  pointer-events: none;
}

/* Floating placeholder */
.floating-placeholder {
  position: absolute;
  left: 6px;
  right: 6px;
  z-index: 10;
  border: 2px dashed rgba(99, 102, 241, 0.8);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.15);
  pointer-events: none;
  overflow: hidden;
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
