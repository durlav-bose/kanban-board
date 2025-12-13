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
        :class="{ 'is-reordering': isDragging }"
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
            <!-- PLACEHOLDER -->
            <div
              v-if="item.isPlaceholder"
              class="task-wrapper placeholder-wrapper"
              :style="{ height: `${placeholderHeight}px` }"
            >
              <div class="floating-placeholder"></div>
            </div>

            <!-- GHOST (invisible dragged task keeping its space) -->
            <div
              v-else-if="item.isGhost"
              class="task-wrapper ghost-wrapper"
              :style="{ height: `${placeholderHeight}px` }"
            >
              <!-- Empty - just reserves space that collapses when not needed -->
            </div>

            <!-- REAL TASK -->
            <div
              v-else
              class="task-wrapper"
              :data-task-id="item.id"
              :data-original-index="originalIndexById[item.id]"
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

      <!-- Empty column drop zone -->
      <div
        v-if="column.tasks.length === 0"
        class="empty-drop-zone"
        @dragover.prevent="handleEmptyColumnDragOver"
      >
        <div v-if="isDropTarget" class="empty-placeholder" :style="{ height: `${placeholderHeight}px` }"></div>
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

// Throttle for drag updates
const lastDropUpdate = ref(0);
const DRAG_UPDATE_THROTTLE = 16;

// =====================
// COMPUTED HELPERS
// =====================

const isDragging = computed(() => {
  return !!dragDrop?.isDragging?.value;
});

const isDropTarget = computed(() => {
  return isDragging.value && dragDrop?.dropTargetColumnId?.value === props.column.id;
});

const isSourceColumn = computed(() => {
  return dragDrop?.sourceColumnId?.value === props.column.id;
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
// RENDER ITEMS - THE MAGIC
// =====================
// 
// Linear-style behavior:
// 1. Remove the dragged task from its original position
// 2. Insert a placeholder at the drop target position
// 3. The scroller handles smooth reflow naturally
//
// For same-column drags:
//   - Remove task from source index
//   - Insert placeholder at target index (in the filtered list)
//
// For cross-column drags:
//   - Source column: Just filter out the dragged task (or show ghost)
//   - Target column: Insert placeholder at target index

const renderItems = computed(() => {
  const tasks = props.column.tasks;
  const isDragging = dragDrop?.isDragging?.value;
  
  if (!isDragging || !draggedTaskId.value) {
    return tasks;
  }

  const srcCol = dragDrop.sourceColumnId.value;
  const tgtCol = dragDrop.dropTargetColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;
  const tgtIdx = dragDrop.dropTargetIndex.value;
  const dragId = draggedTaskId.value;

  // === SAME COLUMN DRAG ===
  if (srcCol === props.column.id && tgtCol === props.column.id) {
    // Remove the dragged task and insert placeholder at new position
    const filtered = tasks.filter(t => t.id !== dragId);
    
    // Clamp target index to valid range
    const insertAt = Math.max(0, Math.min(tgtIdx, filtered.length));
    
    // Insert placeholder
    const result = [...filtered];
    result.splice(insertAt, 0, {
      id: `__placeholder__${props.column.id}`,
      isPlaceholder: true
    });
    
    return result;
  }

  // === SOURCE COLUMN (cross-column drag) ===
  if (srcCol === props.column.id && tgtCol !== props.column.id) {
    // Just filter out the dragged task - it's "gone" from this column
    return tasks.filter(t => t.id !== dragId);
  }

  // === TARGET COLUMN (cross-column drag) ===
  if (tgtCol === props.column.id && srcCol !== props.column.id) {
    // Insert placeholder at target position
    const insertAt = Math.max(0, Math.min(tgtIdx, tasks.length));
    
    const result = [...tasks];
    result.splice(insertAt, 0, {
      id: `__placeholder__${props.column.id}`,
      isPlaceholder: true
    });
    
    return result;
  }

  // Not involved in current drag
  return tasks;
});

function getSizeDeps(item) {
  if (item?.isPlaceholder) return [placeholderHeight.value];
  if (item?.isGhost) return [placeholderHeight.value];
  return [item.title, item.description, item.priority];
}

// =====================
// DROP INDEX CALCULATION
// =====================

/**
 * Calculate drop index when hovering over a task.
 * 
 * The key insight: we need to calculate the index in terms of the ORIGINAL
 * task list (column.tasks), not the rendered list. This is because:
 * 1. The drop handler uses original indices
 * 2. The renderItems computed will handle the visual transformation
 */
function computeDropIndex(event, hoveredTask) {
  // Get original index of hovered task
  const hoveredOriginalIndex = originalIndexById.value[hoveredTask.id];
  if (hoveredOriginalIndex === undefined) return 0;

  // Get mouse position relative to task
  const wrapper = event.currentTarget;
  const rect = wrapper.getBoundingClientRect();
  const mouseY = event.clientY;
  const midpoint = rect.top + rect.height / 2;
  
  // Above midpoint = insert before, below = insert after
  const insertAfter = mouseY >= midpoint;
  
  const srcCol = dragDrop.sourceColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;
  const dragId = draggedTaskId.value;

  // === SAME COLUMN ===
  if (srcCol === props.column.id) {
    // We're calculating index in "without dragged task" space
    // because that's what renderItems uses
    
    // If hovering over the dragged task itself (shouldn't happen but safety)
    if (hoveredTask.id === dragId) {
      return dragDrop.dropTargetIndex.value ?? srcIdx;
    }
    
    // Determine the index in filtered space
    let targetInFilteredSpace;
    
    if (hoveredOriginalIndex < srcIdx) {
      // Hovered task is BEFORE source - its filtered index = original index
      targetInFilteredSpace = insertAfter ? hoveredOriginalIndex + 1 : hoveredOriginalIndex;
    } else {
      // Hovered task is AFTER source - its filtered index = original index - 1
      const filteredIdx = hoveredOriginalIndex - 1;
      targetInFilteredSpace = insertAfter ? filteredIdx + 1 : filteredIdx;
    }
    
    // Clamp
    const maxIdx = props.column.tasks.length - 1; // -1 because dragged is removed
    return Math.max(0, Math.min(targetInFilteredSpace, maxIdx));
  }

  // === DIFFERENT COLUMN (this is target) ===
  // Simple: just use original index directly
  let targetIdx = insertAfter ? hoveredOriginalIndex + 1 : hoveredOriginalIndex;
  return Math.max(0, Math.min(targetIdx, props.column.tasks.length));
}

/**
 * Calculate drop index when hovering in column empty space
 */
function computeDropIndexInEmptySpace(event) {
  const container = tasksContainerRef.value;
  if (!container) return props.column.tasks.length;

  // Find all task wrappers (not placeholders or ghosts)
  const wrappers = Array.from(
    container.querySelectorAll(".task-wrapper[data-task-id]")
  );
  
  if (wrappers.length === 0) {
    return 0;
  }

  const mouseY = event.clientY;
  const dragId = draggedTaskId.value;
  const srcCol = dragDrop.sourceColumnId.value;
  const srcIdx = dragDrop.sourceIndex.value;
  
  // Find insertion point
  let insertIndex = props.column.tasks.length;

  for (const el of wrappers) {
    const taskId = el.getAttribute("data-task-id");
    const originalIdx = originalIndexById.value[taskId];
    
    if (originalIdx === undefined) continue;
    
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (mouseY < mid) {
      // Same column: need to convert to filtered space
      if (srcCol === props.column.id) {
        if (originalIdx < srcIdx) {
          insertIndex = originalIdx;
        } else {
          insertIndex = originalIdx - 1;
        }
      } else {
        insertIndex = originalIdx;
      }
      break;
    }
  }

  // Clamp based on whether we're in same column
  const maxIdx = srcCol === props.column.id 
    ? props.column.tasks.length - 1 
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
};

const handleTaskDragOver = (event, hoveredTask) => {
  if (!draggedTaskId.value) return;
  
  // Don't process placeholder items
  if (hoveredTask.isPlaceholder || hoveredTask.isGhost) return;
  
  event.stopPropagation();

  const now = Date.now();
  if (now - lastDropUpdate.value < DRAG_UPDATE_THROTTLE) return;
  lastDropUpdate.value = now;

  const idx = computeDropIndex(event, hoveredTask);
  dragDrop.handleDragOver(event, props.column.id, idx);
};

const handleColumnDragOver = (event) => {
  if (!draggedTaskId.value) return;

  const idx = computeDropIndexInEmptySpace(event);
  dragDrop.handleDragOver(event, props.column.id, idx);
};

const handleEmptyColumnDragOver = (event) => {
  if (!draggedTaskId.value) return;
  event.preventDefault();

  dragDrop.handleDragOver(event, props.column.id, 0);
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

/* ==========================================
   TASK SWAP ANIMATIONS
   
   When dragging, tasks smoothly animate to 
   fill gaps as the placeholder moves.
   ========================================== */

/* Animate scroller item positions during drag */
.tasks-scroller.is-reordering :deep(.vue-recycle-scroller__item-view) {
  transition: transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* ==========================================
   TASK WRAPPER
   ========================================== */
.task-wrapper {
  padding: 4px 6px;
}

/* ==========================================
   PLACEHOLDER - Simple, no animation
   ========================================== */
.placeholder-wrapper {
  padding: 4px 6px;
  pointer-events: none;
}

.floating-placeholder {
  height: 100%;
  border: 2px dashed rgba(99, 102, 241, 0.5);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
}

/* ==========================================
   GHOST - Invisible spacer
   ========================================== */
.ghost-wrapper {
  pointer-events: none;
  opacity: 0;
}

/* ==========================================
   EMPTY COLUMN
   ========================================== */
.empty-drop-zone {
  flex: 1;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.empty-placeholder {
  width: 100%;
  border: 2px dashed rgba(99, 102, 241, 0.5);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
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