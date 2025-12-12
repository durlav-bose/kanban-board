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
    
    <RecycleScroller
      ref="scrollerRef"
  class="tasks-scroller"
  :items="filteredTasks"        
  :item-size="100"
  key-field="id"
  :buffer="300"
  :page-mode="false"
  @scroll="handleScroll"
    >
      <template #default="{ item, index }">
        <div 
          v-if="dragDrop.shouldShowPlaceholder(column.id, index)"
          class="task-placeholder"
          :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
        >
          <div class="placeholder-inner"></div>
        </div>

        <div 
          class="task-wrapper"
          :data-task-index="index"
          :data-task-id="item.id"
          @dragover.prevent.stop="handleTaskDragOver($event, index)"
        >
          <KanbanTask
            :task="item"
            :class="{ 'being-dragged': isTaskBeingDragged(item.id) }"
            @dragstart="handleTaskDragStart($event, item, index)"
            @dragend="handleTaskDragEnd"
          />
        </div>
      </template>
      
      </RecycleScroller>
    
    <div 
      v-if="dragDrop.shouldShowPlaceholderAtEnd(column.id, column.tasks.length)"
      class="task-placeholder"
      :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
    >
      <div class="placeholder-inner"></div>
    </div>
    
    <div
      v-if="dragDrop.shouldShowEmptyPlaceholder(column.id, isColumnEmpty)"
      class="empty-column-drop-target"
      @dragover.prevent="handleEmptyColumnDragOver"
    >
      <span class="text-center">Drop task here</span>
    </div>
    
  </div>
</template>

<script setup>
import { ref, inject, computed, onMounted, onUnmounted } from "vue";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import KanbanTask from "./KanbanTask.vue";

const props = defineProps({
  column: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["task-move"]);

const dragDrop = inject("kanbanDragDrop");
const scrollerRef = ref(null);

// Check if this task is being dragged
const isTaskBeingDragged = (taskId) => {
  return dragDrop.draggedTask.value?.id === taskId
};

// CRITICAL FIX: Define the filtered list
const filteredTasks = computed(() => {
  if (!dragDrop.isDragging.value) {
    // Return original list when not dragging
    return props.column.tasks
  }
  
  // Filter out the dragged task based on ID
  return props.column.tasks.filter(
    (t) => !isTaskBeingDragged(t.id)
  )
})

// Check if column is empty
const isColumnEmpty = computed(() => filteredTasks.value.length === 0)

// Check if this column is the current drop target
const isDropTarget = computed(() => {
  return (
    dragDrop.isDragging.value &&
    dragDrop.dropTargetColumnId.value === props.column.id
  );
});

// ============ EVENT HANDLERS ============
const handleTaskDragStart = (event, task, index) => {
  // CRITICAL FIX: Use event.target.closest('[draggable="true"]') 
  // to reliably find the outer element of the task component.
  const element = event.target.closest('[draggable="true"]')
  
  if (!element) {
    console.error('Failed to find draggable element in KanbanColumn.')
    // Prevent the drag from continuing if element is null
    event.preventDefault() 
    return
  }
  
  // Pass the actual DOM element to the hook
  dragDrop.handleDragStart(event, task, props.column.id, index, element)
}

const handleTaskDragEnd = () => {
  dragDrop.handleDragEnd();
};

const handleTaskDragOver = (event, index) => {
  event.stopPropagation();
  dragDrop.handleDragOver(event, props.column.id, index);
};

const handleColumnDragOver = (event) => {
  event.preventDefault();

  // Use mouse position to calculate drop index
  const mouseY = event.clientY;
  const column = event.currentTarget;

  // Get all visible task elements
  const taskElements = Array.from(column.querySelectorAll("[data-task-id]"));

  if (taskElements.length === 0) {
    dragDrop.dropTargetColumnId.value = props.column.id;
    dragDrop.dropTargetIndex.value = 0;
    return;
  }

  // Find insertion point based on mouse Y
  let insertIndex = taskElements.length;

  for (let i = 0; i < taskElements.length; i++) {
    const rect = taskElements[i].getBoundingClientRect();
    const middle = rect.top + rect.height / 2;

    if (mouseY < middle) {
      insertIndex = i;
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
  dragDrop.handleEmptyColumnDragOver(event, props.column.id);
};

const handleScroll = () => {
  // Can be used for auto-scroll during drag if needed
};

// ============ ESC KEY TO CANCEL ============
let escapeHandler = null;

onMounted(() => {
  escapeHandler = (e) => {
    if (e.key === "Escape" && dragDrop.isDragging.value) {
      console.log("[ESC] Cancelling drag");
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

.tasks-scroller {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 100px;
  position: relative;
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
  transition: background 0.2s;
}

.tasks-scroller::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.task-wrapper {
  padding: 6px;
}

.task-placeholder {
  margin: 6px;
  border: 2px dashed rgba(99, 102, 241, 0.7);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(99, 102, 241, 0.08);
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
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.placeholder-fade-enter-active {
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
}

.placeholder-fade-leave-active {
  transition: all 0.08s cubic-bezier(0.4, 0, 0.2, 1);
}

.placeholder-fade-enter-from,
.placeholder-fade-leave-to {
  opacity: 0;
  transform: scaleY(0.7);
}

.empty-drop-zone {
  min-height: 100px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
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

/* Hide the task being dragged but keep it in the DOM for drag to work */
.task-wrapper .being-dragged {
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1024px) {
  .task-column {
    min-width: 240px;
  }
}

@media (max-width: 768px) {
  .task-column {
    max-height: none;
  }
}
</style>
