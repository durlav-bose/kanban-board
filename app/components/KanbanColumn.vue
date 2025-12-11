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
      <!-- Floating placeholder -->
      <div 
        v-if="showPlaceholder"
        class="floating-placeholder"
        :style="placeholderStyle"
      >
        <div class="placeholder-inner"></div>
      </div>
      
      <!-- Using DynamicScroller for variable height items -->
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
            :size-dependencies="[
              item.title,
              item.description,
              item.priority
            ]"
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
    
    <!-- Empty column state -->
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

// Constants for dynamic scroller
const MIN_ITEM_SIZE = 80;
const PLACEHOLDER_HEIGHT = 80;

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["task-move"]);

const dragDrop = inject("kanbanDragDrop");
const scrollerRef = ref(null);
const tasksContainerRef = ref(null);

// ============ COMPUTED STATE ============

const isDropTarget = computed(() => {
  return dragDrop.isDragging.value && dragDrop.dropTargetColumnId.value === props.column.id;
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

// Is this the SOURCE column (where drag started)?
const isSourceColumn = computed(() => {
  return dragDrop.isDragging.value && dragDrop.sourceColumnId.value === props.column.id;
});

// ============ PLACEHOLDER LOGIC ============

const placeholderInfo = computed(() => {
  if (!dragDrop.isDragging.value) return null;
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
  if (dragDrop.dropTargetIndex.value === null) return null;
  
  const dropIdx = dragDrop.dropTargetIndex.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id;
  
  // Same column: don't show placeholder at source or source+1
  if (isSameColumn) {
    if (dropIdx === sourceIdx) return null;
    if (dropIdx === sourceIdx + 1) return null;
  }
  
  return {
    dropIndex: dropIdx,
    isSameColumn,
    sourceIndex: sourceIdx
  };
});

const showPlaceholder = computed(() => placeholderInfo.value !== null);

// Calculate placeholder Y position
// const placeholderStyle = computed(() => {
//   if (!placeholderInfo.value) return { display: 'none' };
  
//   const { dropIndex, isSameColumn, sourceIndex } = placeholderInfo.value;
  
//   // Get scroll position
//   const scrollTop = scrollerRef.value?.$el?.scrollTop || 0;
  
//   // Calculate visual index for positioning
//   let visualIndex = dropIndex;
//   if (isSameColumn && dropIndex > sourceIndex) {
//     // Account for the hidden source task
//     visualIndex = dropIndex - 1;
//   }
  
//   // Position based on item size
//   const top = (visualIndex * ITEM_SIZE) - scrollTop;
  
//   return {
//     top: `${top}px`,
//     height: `${PLACEHOLDER_HEIGHT}px`,
//   };
// });

const placeholderStyle = computed(() => {
  if (!placeholderInfo.value) return { display: 'none' };
  
  const { dropIndex, isSameColumn, sourceIndex } = placeholderInfo.value;
  
  // Get the scroller element
  const scroller = scrollerRef.value?.$el?.querySelector('.vue-recycle-scroller__item-wrapper')?.parentElement;
  const scrollTop = scroller?.scrollTop || 0;
  
  // Get all rendered task wrapper elements
  const taskWrappers = tasksContainerRef.value?.querySelectorAll('.task-wrapper') || [];
  
  // Calculate cumulative height up to dropIndex
  let cumulativeHeight = 0;
  let placeholderHeight = MIN_ITEM_SIZE; // Default placeholder height
  
  // Get the dragged task's height
  if (isSameColumn) {
    // For same column: find the actual DOM element
    const draggedTaskElement = Array.from(taskWrappers).find(wrapper => {
      const index = parseInt(wrapper.dataset.taskIndex);
      return index === sourceIndex;
    });
    
    if (draggedTaskElement) {
      placeholderHeight = draggedTaskElement.offsetHeight;
    }
  } else {
    // For cross-column: use the stored height from dragDrop
    placeholderHeight = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
  }
  
  // Sum up heights of all tasks before the drop position
  // Important: Account for tasks that are shifted (moving up to fill gaps)
  for (let i = 0; i < dropIndex; i++) {
    const wrapper = Array.from(taskWrappers).find(w => parseInt(w.dataset.taskIndex) === i);
    if (wrapper) {
      cumulativeHeight += wrapper.offsetHeight;
    } else {
      // Fallback to min size if element not rendered
      cumulativeHeight += MIN_ITEM_SIZE;
    }
  }
  
  // If moving down in same column, we need to subtract the source task height
  // because tasks between source and drop are shifting up
  if (isSameColumn && dropIndex > sourceIndex) {
    cumulativeHeight -= placeholderHeight;
  }
  
  const top = cumulativeHeight - scrollTop;
  
  return {
    top: `${top}px`,
    height: `${placeholderHeight}px`,
  };
});

// ============ SHIFT LOGIC ============

/**
 * Determine which tasks should shift and in which direction.
 * Returns: 'up' | 'down' | null
 */
const getShiftDirection = (index) => {
  if (!dragDrop.isDragging.value) return null;
  
  const sourceCol = dragDrop.sourceColumnId.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const targetCol = dragDrop.dropTargetColumnId.value;
  const thisCol = props.column.id;
  
  // Handle SOURCE column
  if (thisCol === sourceCol) {
    if (!placeholderInfo.value) {
      // No placeholder in this column, but we're the source column
      // All tasks after source should shift UP to fill the gap
      if (index > sourceIdx) {
        console.log(`[SHIFT] ${thisCol}[${index}]: UP (fill source gap, no placeholder)`);
        return 'up';
      }
      return null;
    }
    
    // Same column drag with placeholder
    const { dropIndex, isSameColumn } = placeholderInfo.value;
    
    if (index === sourceIdx) {
      return null; // Source task stays invisible
    }
    
    if (dropIndex < sourceIdx) {
      // Moving UP: tasks between drop and source shift DOWN
      if (index >= dropIndex && index < sourceIdx) {
        console.log(`[SHIFT] ${thisCol}[${index}]: DOWN (make space, moving up)`);
        return 'down';
      }
      return null;
    } else if (dropIndex > sourceIdx) {
      // Moving DOWN: tasks between source and drop shift UP
      if (index > sourceIdx && index < dropIndex) {
        console.log(`[SHIFT] ${thisCol}[${index}]: UP (fill gap, moving down)`);
        return 'up';
      }
      return null;
    }
    
    return null;
  }
  
  // Handle TARGET column (different from source)
  if (thisCol === targetCol && placeholderInfo.value) {
    const { dropIndex } = placeholderInfo.value;
    // Tasks at and after drop index shift DOWN to make space
    if (index >= dropIndex) {
      console.log(`[SHIFT] ${thisCol}[${index}]: DOWN (make space in target)`);
      return 'down';
    }
  }
  
  return null;
};

// Calculate the shift class based on direction
const getShiftClass = (index) => {
  const direction = getShiftDirection(index);
  if (direction === 'down') return 'is-shifted';
  if (direction === 'up') return 'is-shifted-up';
  return '';
};

// Get inline shift style with dynamic height
const getShiftStyle = (index) => {
  const direction = getShiftDirection(index);
  if (!direction) return {};
  
  const sourceCol = dragDrop.sourceColumnId.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const thisCol = props.column.id;
  
  // Get the dragged task element to measure its height
  const taskWrappers = tasksContainerRef.value?.querySelectorAll('.task-wrapper') || [];
  let shiftAmount = MIN_ITEM_SIZE;
  
  if (thisCol === sourceCol) {
    // This IS the source column: measure the actual source task
    const draggedTaskElement = Array.from(taskWrappers).find(wrapper => {
      const wrapperIndex = parseInt(wrapper.dataset.taskIndex);
      return wrapperIndex === sourceIdx;
    });
    shiftAmount = draggedTaskElement?.offsetHeight || MIN_ITEM_SIZE;
    console.log(`[SHIFT AMOUNT] Source column ${thisCol}: ${shiftAmount}px (measured from DOM)`);
  } else {
    // This is NOT the source column (target column): use stored height
    shiftAmount = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
    console.log(`[SHIFT AMOUNT] Target column ${thisCol}: ${shiftAmount}px (from dragDrop)`);
  }
  
  if (direction === 'up') {
    // Shift UP to fill gap
    return { transform: `translateY(-${shiftAmount}px)` };
  } else if (direction === 'down') {
    // Shift DOWN to make space
    return { transform: `translateY(${shiftAmount}px)` };
  }
  
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
  
  const wrapper = event.currentTarget;
  if (wrapper.classList.contains('is-dragging-source')) return;
  
  const rect = wrapper.getBoundingClientRect();
  const mouseY = event.clientY;
  const middle = rect.top + rect.height / 2;
  
  const dropIndex = mouseY < middle ? index : index + 1;
  dragDrop.handleDragOver(event, props.column.id, dropIndex);
};

const handleColumnDragOver = (event) => {
  if (!dragDrop.isDragging.value) return;
  event.preventDefault();

  const mouseY = event.clientY;
  const container = tasksContainerRef.value;
  if (!container) return;

  const taskWrappers = Array.from(container.querySelectorAll('.task-wrapper[data-task-index]'))
    .filter(el => !el.classList.contains('is-dragging-source'));
  
  if (taskWrappers.length === 0) {
    dragDrop.dropTargetColumnId.value = props.column.id;
    dragDrop.dropTargetIndex.value = 0;
    return;
  }

  let insertIndex = props.column.tasks.length;

  for (const wrapper of taskWrappers) {
    const rect = wrapper.getBoundingClientRect();
    if (rect.height === 0) continue;
    
    const taskIndex = parseInt(wrapper.dataset.taskIndex || '0');
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

defineExpose({
  scrollerRef,
});
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

/* Tasks container - THIS IS CRITICAL FOR SCROLL */
.tasks-container {
  flex: 1;
  min-height: 0; /* Critical for flex child to scroll */
  position: relative;
  overflow: hidden;
}

/* RecycleScroller needs explicit height */
.tasks-scroller {
  height: 100%;
  overflow-y: auto !important;
  overflow-x: hidden;
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

/* Source task - invisible */
.task-wrapper.is-dragging-source {
  opacity: 0;
  pointer-events: none;
}

/* Shifted tasks - transforms applied via inline styles for dynamic heights */

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