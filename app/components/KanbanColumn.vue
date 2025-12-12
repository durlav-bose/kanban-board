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

// ============ PLACEHOLDER LOGIC ============

// const placeholderInfo = computed(() => {
//   if (!dragDrop.isDragging.value) return null;
//   if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
//   if (dragDrop.dropTargetIndex.value === null) return null;
  
//   const dropIdx = dragDrop.dropTargetIndex.value;
//   const sourceIdx = dragDrop.sourceIndex.value;
//   const isSameColumn = dragDrop.sourceColumnId.value === props.column.id;
  
//   if (isSameColumn) {
//     // If the drop target is EXACTLY the source index, we display the placeholder.
//     if (dropIdx === sourceIdx) {
//       return { dropIndex: sourceIdx, isSameColumn, sourceIndex: sourceIdx };
//     }
    
//     // We remove the dropIdx === sourceIdx + 1 check to allow the placeholder to show 
//     // when moving down (Fix 1). The shifting logic handles the visual collapse.
//   }
  
//   return {
//     dropIndex: dropIdx,
//     isSameColumn,
//     sourceIndex: sourceIdx
//   };
// });

const placeholderInfo = computed(() => {
  if (!dragDrop.isDragging.value) return null;
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
  if (dragDrop.dropTargetIndex.value === null) return null;
  
  const dropIdx = dragDrop.dropTargetIndex.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id;
  
  // Same column: don't show placeholder at source
  if (isSameColumn) {
    if (dropIdx === sourceIdx) return null;
    // FIX: Removed the check for dropIdx === sourceIdx + 1 
    // to allow placeholder to show when moving down past the source's original spot.
  }
  
  return {
    dropIndex: dropIdx,
    isSameColumn,
    sourceIndex: sourceIdx
  };
});

// const showPlaceholder = computed(() => placeholderInfo.value !== null);

// const placeholderStyle = computed(() => {
//   if (!placeholderInfo.value || !tasksContainerRef.value) return { display: 'none' };
  
//   const { dropIndex, isSameColumn, sourceIndex } = placeholderInfo.value;
  
//   // Get all rendered task wrapper elements
//   const taskWrappers = tasksContainerRef.value?.querySelectorAll('.task-wrapper') || [];
  
//   // 1. Get placeholder height
//   let placeholderHeight = MIN_ITEM_SIZE;
//   if (isSameColumn) {
//     const draggedTaskElement = Array.from(taskWrappers).find(wrapper => {
//       const index = parseInt(wrapper.dataset.taskIndex);
//       return index === sourceIndex;
//     });
//     if (draggedTaskElement) {
//       placeholderHeight = draggedTaskElement.offsetHeight;
//     }
//   } else {
//     placeholderHeight = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
//   }
  
//   // 2. Calculate top position using Bounding Box (Fix 2)
//   let top = 0;
//   const containerRect = tasksContainerRef.value.getBoundingClientRect();
  
//   // Case A: Drop BEFORE an existing task (dropIndex < total tasks)
//   if (dropIndex < props.column.tasks.length) {
//     const targetWrapper = Array.from(taskWrappers).find(w => 
//         parseInt(w.dataset.taskIndex) === dropIndex
//     );
    
//     if (targetWrapper) {
//       const wrapperRect = targetWrapper.getBoundingClientRect();
//       // Position is the top of the target element, relative to the container
//       top = wrapperRect.top - containerRect.top;
      
//     } else {
//       // Fallback: If the target item is unrendered/off-screen (due to virtualization),
//       // rely on estimation from the scroller's visible position if possible.
//       const scrollerElement = scrollerRef.value?.$el;
//       const scrollTop = scrollerElement ? scrollerElement.scrollTop : 0;
      
//       // Use cumulative height up to dropIndex as the fallback position
//       let cumulativeTop = 0;
//       for (let i = 0; i < dropIndex; i++) {
//         const wrapper = Array.from(taskWrappers).find(w => 
//           parseInt(w.dataset.taskIndex) === i
//         );
//         if (wrapper) {
//           cumulativeTop += wrapper.offsetHeight;
//         } else {
//           cumulativeTop += MIN_ITEM_SIZE;
//         }
//       }
      
//       // Adjust for same-column moves in fallback
//       if (isSameColumn && dropIndex > sourceIndex) {
//         cumulativeTop -= placeholderHeight;
//       }
      
//       // Position relative to the visible container
//       top = cumulativeTop - scrollTop; 
//     }
//   } 
//   // Case B: Drop at the very END of the list (dropIndex === total tasks)
//   else if (dropIndex === props.column.tasks.length && taskWrappers.length > 0) {
//     const lastWrapper = taskWrappers[taskWrappers.length - 1];
//     if (lastWrapper) {
//       const lastRect = lastWrapper.getBoundingClientRect();
//       // Top position should be the bottom of the last task, relative to the container
//       top = (lastRect.top - containerRect.top) + lastRect.offsetHeight;
//     }
//   }
  
//   return {
//     top: `${top}px`,
//     height: `${placeholderHeight}px`,
//   };
// });

const showPlaceholder = computed(() => placeholderInfo.value !== null);

const placeholderStyle = computed(() => {
  if (!placeholderInfo.value) return { display: 'none' };
  
  const { dropIndex, isSameColumn, sourceIndex } = placeholderInfo.value;
  
  // Get all rendered task wrapper elements
  const taskWrappers = tasksContainerRef.value?.querySelectorAll('.task-wrapper') || [];
  
  // Get placeholder height (logic remains the same)
  let placeholderHeight = MIN_ITEM_SIZE;
  if (isSameColumn) {
    const draggedTaskElement = Array.from(taskWrappers).find(wrapper => {
      const index = parseInt(wrapper.dataset.taskIndex);
      return index === sourceIndex;
    });
    if (draggedTaskElement) {
      placeholderHeight = draggedTaskElement.offsetHeight;
    }
  } else {
    placeholderHeight = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
  }
  
  // Calculate cumulative position by summing heights (logic remains the same)
  let cumulativeTop = 0;
  
  // Sum heights from index 0 to dropIndex
  for (let i = 0; i < dropIndex; i++) {
    const wrapper = Array.from(taskWrappers).find(w => 
      parseInt(w.dataset.taskIndex) === i
    );
    
    if (wrapper) {
      cumulativeTop += wrapper.offsetHeight;
    } else {
      // Element not rendered, use min size
      cumulativeTop += MIN_ITEM_SIZE;
    }
  }
  
  // Adjust for same-column moves
  if (isSameColumn) {
    if (dropIndex > sourceIndex) {
      // Moving down: source task is before drop, so we counted it
      // But it's invisible, so subtract its height to get the visual position
      cumulativeTop -= placeholderHeight;
    }
  }
  
  // *** FIX: Subtract the scroll offset to get the correct visible position ***
  const scrollTop = scrollerRef.value?.$el?.scrollTop || 0;
  
  return {
    top: `${cumulativeTop - scrollTop}px`, // FIX APPLIED HERE
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
      // No placeholder in this column (e.g., dragged to another column)
      // Tasks after source should shift UP to fill the gap
      if (index > sourceIdx) {
        return 'up';
      }
      return null;
    }
    
    // Same column drag with placeholder
    const { dropIndex } = placeholderInfo.value;
    
    if (index === sourceIdx) {
      return null; // Source task stays invisible
    }
    
    if (dropIndex < sourceIdx) {
      // Moving UP: tasks between drop and source shift DOWN
      if (index >= dropIndex && index < sourceIdx) {
        return 'down';
      }
      return null;
    } else if (dropIndex > sourceIdx) {
      // Moving DOWN: tasks between source and drop shift UP
      if (index > sourceIdx && index < dropIndex) {
        return 'up';
      }
      return null;
    }
    
    return null; // If dropIndex === sourceIdx, no shift needed
  }
  
  // Handle TARGET column (different from source)
  if (thisCol === targetCol && placeholderInfo.value) {
    const { dropIndex } = placeholderInfo.value;
    // Tasks at and after drop index shift DOWN to make space
    if (index >= dropIndex) {
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
  } else {
    // This is NOT the source column (target column): use stored height
    shiftAmount = dragDrop.placeholderHeight.value || MIN_ITEM_SIZE;
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

// const handleTaskDragOver = (event, index) => {
//   if (!dragDrop.isDragging.value) return;
//   event.stopPropagation();
  
//   const wrapper = event.currentTarget;
//   // We no longer skip the source task wrapper (Fix 3)
  
//   const rect = wrapper.getBoundingClientRect();
//   const mouseY = event.clientY;
//   const middle = rect.top + rect.height / 2;
  
//   // If the event is over the source task's wrapper, force dropIndex to sourceIndex
//   if (wrapper.classList.contains('is-dragging-source')) {
//     const dropIndex = index; 
//     dragDrop.handleDragOver(event, props.column.id, dropIndex);
//     return;
//   }
  
//   // For all other tasks: check middle line
//   const dropIndex = mouseY < middle ? index : index + 1;
//   dragDrop.handleDragOver(event, props.column.id, dropIndex);
// };


const handleTaskDragOver = (event, index) => {
  if (!dragDrop.isDragging.value) return;
  event.stopPropagation();
  
  const wrapper = event.currentTarget;
  // FIX: We now allow drag over on the source wrapper to correctly set dropIndex
  // if (wrapper.classList.contains('is-dragging-source')) return; // REMOVED
  
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