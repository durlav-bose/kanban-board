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
    
    <!-- 
      LINEAR-STYLE VIRTUAL SCROLL WITH DRAG & DROP
      
      Key insight: RecycleScroller uses FIXED item heights.
      We CAN'T add placeholder as a DOM element inside slots.
      
      Solution:
      1. Use CSS transforms to shift tasks DOWN when placeholder should appear
      2. Only visible tasks get shifted (virtual scroll handles the rest)
      3. Placeholder is a separate absolutely-positioned element
      4. Smooth 200ms transitions for Linear feel
    -->
    <div class="tasks-container" ref="tasksContainerRef">
      <!-- Floating placeholder - absolutely positioned -->
      <div 
        v-if="showPlaceholder"
        class="floating-placeholder"
        :style="placeholderStyle"
      >
        <div class="placeholder-inner"></div>
      </div>
      
      <RecycleScroller
        ref="scrollerRef"
        class="tasks-scroller"
        :items="column.tasks"
        :item-size="ITEM_HEIGHT"
        key-field="id"
        :buffer="400"
        :page-mode="false"
        @scroll="onScroll"
      >
        <template #default="{ item, index }">
          <div 
            class="task-wrapper"
            :class="{ 'is-dragging-source': isSourceTask(item.id, index) }"
            :style="getTaskTransform(index)"
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
        </template>
      </RecycleScroller>
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
        :style="{ height: `${PLACEHOLDER_HEIGHT}px` }"
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
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import KanbanTask from "./KanbanTask.vue";

// Constants - ITEM_HEIGHT must match RecycleScroller item-size
const ITEM_HEIGHT = 100;
const PLACEHOLDER_HEIGHT = 88;

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
const scrollTop = ref(0);

// ============ COMPUTED STATE ============

const isDropTarget = computed(() => {
  return dragDrop.isDragging.value && dragDrop.dropTargetColumnId.value === props.column.id;
});

// Is this the source task being dragged?
const isSourceTask = (taskId, index) => {
  if (!dragDrop.isDragging.value) return false;
  if (!dragDrop.draggedTask.value) return false;
  
  return (
    dragDrop.sourceColumnId.value === props.column.id &&
    dragDrop.sourceIndex.value === index &&
    dragDrop.draggedTask.value.id === taskId
  );
};

// ============ PLACEHOLDER POSITIONING ============

// Calculate where placeholder should appear (null = don't show)
const placeholderPosition = computed(() => {
  if (!dragDrop.isDragging.value) return null;
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return null;
  if (dragDrop.dropTargetIndex.value === null) return null;
  
  const dropIdx = dragDrop.dropTargetIndex.value;
  const sourceIdx = dragDrop.sourceIndex.value;
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id;
  
  // Same column: don't show placeholder at source position or immediately after
  if (isSameColumn) {
    if (dropIdx === sourceIdx) return null;
    if (dropIdx === sourceIdx + 1) return null;
  }
  
  return {
    index: dropIdx,
    isSameColumn,
    sourceIdx
  };
});

const showPlaceholder = computed(() => placeholderPosition.value !== null);

// Calculate placeholder's visual position (accounting for hidden source)
const placeholderStyle = computed(() => {
  if (!placeholderPosition.value) return { display: 'none' };
  
  const { index, isSameColumn, sourceIdx } = placeholderPosition.value;
  
  // Calculate visual index (where it appears on screen)
  let visualIndex = index;
  
  // If same column and dropping below source, the source is visually "gone"
  // so adjust the visual position
  if (isSameColumn && index > sourceIdx) {
    visualIndex = index - 1;
  }
  
  // Position in the virtual list
  const top = (visualIndex * ITEM_HEIGHT) - scrollTop.value;
  
  return {
    top: `${top + 6}px`,  // 6px for padding
    height: `${PLACEHOLDER_HEIGHT}px`,
    left: '6px',
    right: '6px',
  };
});

// ============ TASK TRANSFORMS ============

/**
 * LINEAR-STYLE TRANSFORM LOGIC
 * 
 * When dragging, tasks below the placeholder position need to shift DOWN
 * to make room for the placeholder. This is done with CSS transforms.
 * 
 * Only visible tasks get this transform (virtual scroll efficiency).
 */
const getTaskTransform = (index) => {
  const baseStyle = {
    transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 150ms ease'
  };
  
  if (!placeholderPosition.value) {
    return { ...baseStyle, transform: 'translateY(0)' };
  }
  
  const { index: dropIdx, isSameColumn, sourceIdx } = placeholderPosition.value;
  
  // Determine if this task should shift down
  let shouldShift = false;
  
  if (isSameColumn) {
    // Same column logic
    if (dropIdx < sourceIdx) {
      // Dropping ABOVE source: shift tasks from dropIdx to sourceIdx-1
      shouldShift = index >= dropIdx && index < sourceIdx;
    } else {
      // Dropping BELOW source: shift tasks from sourceIdx+1 to dropIdx-1
      // (these are the tasks between where source was and where it's going)
      shouldShift = index > sourceIdx && index < dropIdx;
    }
  } else {
    // Cross-column: shift all tasks from dropIdx onwards
    shouldShift = index >= dropIdx;
  }
  
  if (shouldShift) {
    return { 
      ...baseStyle, 
      transform: `translateY(${PLACEHOLDER_HEIGHT}px)` 
    };
  }
  
  return { ...baseStyle, transform: 'translateY(0)' };
};

// Track scroll position for placeholder positioning
const onScroll = () => {
  if (scrollerRef.value?.$el) {
    scrollTop.value = scrollerRef.value.$el.scrollTop;
  }
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
  
  // Get the actual task element (not the shifted position)
  const wrapper = event.currentTarget;
  const rect = wrapper.getBoundingClientRect();
  const mouseY = event.clientY;
  
  // Account for any transform on this element
  const style = window.getComputedStyle(wrapper);
  const matrix = new DOMMatrix(style.transform);
  const translateY = matrix.m42; // Get Y translation
  
  // Adjust rect for the transform
  const actualTop = rect.top - translateY;
  const actualMiddle = actualTop + (ITEM_HEIGHT / 2);
  
  // Determine drop position
  const dropIndex = mouseY < actualMiddle ? index : index + 1;
  
  dragDrop.handleDragOver(event, props.column.id, dropIndex);
};

const handleColumnDragOver = (event) => {
  if (!dragDrop.isDragging.value) return;
  event.preventDefault();

  const mouseY = event.clientY;
  const container = tasksContainerRef.value;
  if (!container) return;

  const taskElements = Array.from(container.querySelectorAll("[data-task-index]"));
  
  if (taskElements.length === 0 || props.column.tasks.length === 0) {
    dragDrop.dropTargetColumnId.value = props.column.id;
    dragDrop.dropTargetIndex.value = 0;
    return;
  }

  // Find insertion point
  let insertIndex = props.column.tasks.length;

  for (const el of taskElements) {
    // Skip the source task when calculating
    if (el.classList.contains('is-dragging-source')) continue;
    
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    
    const taskIndex = parseInt(el.dataset.taskIndex || '0');
    
    // Account for transform
    const style = window.getComputedStyle(el);
    const matrix = new DOMMatrix(style.transform);
    const translateY = matrix.m42;
    const actualTop = rect.top - translateY;
    const middle = actualTop + (ITEM_HEIGHT / 2);

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
  padding: 20px;
  flex: 1;
  min-width: 280px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(71, 85, 105, 0.5);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.task-column.column-drag-over {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2),
    inset 0 0 0 1px rgba(99, 102, 241, 0.2);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(71, 85, 105, 0.5);
}

.column-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #e2e8f0;
}

.task-count {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
}

/* Container for tasks + floating placeholder */
.tasks-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 100px;
}

.tasks-scroller {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.tasks-scroller::-webkit-scrollbar {
  width: 6px;
}

.tasks-scroller::-webkit-scrollbar-track {
  background: transparent;
}

.tasks-scroller::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.tasks-scroller::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Task wrapper with transform support */
.task-wrapper {
  padding: 6px;
  will-change: transform;
}

/* Source task being dragged */
.task-wrapper.is-dragging-source {
  opacity: 0.3;
  pointer-events: none;
}

/* Floating placeholder - positioned absolutely over the scroller */
.floating-placeholder {
  position: absolute;
  z-index: 10;
  border: 2px dashed rgba(99, 102, 241, 0.8);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  pointer-events: none;
  overflow: hidden;
  transition: top 150ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.placeholder-inner {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(99, 102, 241, 0) 0%,
    rgba(99, 102, 241, 0.3) 50%,
    rgba(99, 102, 241, 0) 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Empty column */
.empty-drop-zone {
  min-height: 100px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.empty-placeholder {
  width: 100%;
  border: 2px dashed rgba(99, 102, 241, 0.8);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  position: relative;
  overflow: hidden;
}

.empty-state {
  text-align: center;
  color: #64748b;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

@media (max-width: 1024px) {
  .task-column { min-width: 240px; }
}

@media (max-width: 768px) {
  .task-column { max-height: none; }
}
</style>