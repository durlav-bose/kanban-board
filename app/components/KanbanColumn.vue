<template>
  <div 
    class="task-column" 
    :data-column="column.id"
    @dragover.prevent="handleColumnDragOver"
    @drop.prevent="handleColumnDrop"
  >
    <div class="column-header">
      <h2>{{ column.title }}</h2>
      <span class="task-count">{{ column.tasks.length }}</span>
    </div>
    
    <!-- Virtual Scroller -->
    <DynamicScroller
      ref="scroller"
      :items="column.tasks"
      :min-item-size="minItemSize"
      class="tasks-scroller"
      key-field="id"
      :buffer="buffer"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[
            item.title,
            item.priority,
          ]"
          :data-index="index"
        >
          <!-- Placeholder before task -->
          <transition name="placeholder-fade">
            <div 
              v-if="shouldShowPlaceholderBefore(item.id, index)"
              class="task-placeholder"
              :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
            >
              <div class="placeholder-inner"></div>
            </div>
          </transition>

          <!-- Task Card OR Source Placeholder -->
          <div 
            v-if="isTaskBeingDragged(item.id) && !hideOldPlaceholder"
            class="task-placeholder source-placeholder"
            :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
          >
            <div class="placeholder-inner"></div>
          </div>
          
          <div 
            v-else
            class="task-wrapper"
            :data-task-index="index"
            :data-task-id="item.id"
            @dragover.prevent="handleTaskDragOver($event, index)"
          >
            <KanbanTask
              :task="item"
              @dragstart="handleTaskDragStart($event, item, index)"
              @dragend="handleTaskDragEnd"
            />
          </div>

          <!-- Placeholder after last task -->
          <transition name="placeholder-fade">
            <div 
              v-if="shouldShowPlaceholderAfter(item.id, index)"
              class="task-placeholder"
              :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
            >
              <div class="placeholder-inner"></div>
            </div>
          </transition>
        </DynamicScrollerItem>
      </template>
      
      <!-- Empty column drop zone -->
      <template #after v-if="column.tasks.length === 0">
        <div 
          class="empty-drop-zone"
          @dragover.prevent="handleEmptyDragOver"
        >
          <transition name="placeholder-fade">
            <div 
              v-if="dragDrop.shouldShowEmptyPlaceholder(column.id, true)"
              class="task-placeholder"
              :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
            >
              <div class="placeholder-inner"></div>
            </div>
          </transition>
          <div v-if="column.tasks.length === 0 || dragDrop.isDragging.value" class="empty-state">
            <span class="empty-icon">📋</span>
            <span>Drop tasks here</span>
          </div>
        </div>
      </template>
    </DynamicScroller>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import KanbanTask from './KanbanTask.vue'

const props = defineProps({
  column: {
    type: Object,
    required: true
  },
  minItemSize: {
    type: Number,
    default: 100
  },
  buffer: {
    type: Number,
    default: 200
  }
})

const emit = defineEmits(['task-move'])

const dragDrop = inject('kanbanDragDrop')
const scroller = ref(null)

// ✅ Check if this task is currently being dragged
const isTaskBeingDragged = (taskId) => {
  return dragDrop.isDragging.value && 
         dragDrop.draggedTask.value?.id === taskId &&
         dragDrop.sourceColumnId.value === props.column.id
}

let hideOldPlaceholder = ref(false);

// ✅ Show placeholder before this task
const shouldShowPlaceholderBefore = (taskId, index) => {
  if (!dragDrop.isDragging.value) return false
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return false
  
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id
  const sourceIndex = dragDrop.draggedTaskIndex.value
  const dropIndex = dragDrop.dropTargetIndex.value
  
  if (isSameColumn) {
    // ✅ CRITICAL: In same column, source placeholder serves as THE placeholder
    // Only show additional placeholder if drop position is DIFFERENT from source
    if (dropIndex === sourceIndex) {
      // Dropping at same position - no additional placeholder needed
      return false
    }
    
    // Show placeholder at drop position, but NOT at source (source has its own placeholder)
    if (index === sourceIndex) {
      return false // Source already has placeholder
    }

    hideOldPlaceholder.value = true;
    
    return dropIndex === index
  } else {
    // Different column - show placeholder at drop position
    return dropIndex === index
  }
}

// ✅ Show placeholder after this task
const shouldShowPlaceholderAfter = (taskId, index) => {
  if (!dragDrop.isDragging.value) return false
  if (dragDrop.dropTargetColumnId.value !== props.column.id) return false
  
  const isLast = index === props.column.tasks.length - 1
  if (!isLast) return false
  
  const isSameColumn = dragDrop.sourceColumnId.value === props.column.id
  const dropIndex = dragDrop.dropTargetIndex.value
  
  if (isSameColumn) {
    // In same column, check if dropping after last task
    return dropIndex > index
  } else {
    // Different column
    return dropIndex > index
  }
}

const handleTaskDragStart = (event, task, index) => {
  const element = event.target.closest('.task')
  if (!element) return
  
  dragDrop.handleDragStart(event, task, props.column.id, index, element)
}

const handleTaskDragEnd = (event) => {
  const element = event.target.closest('.task')
  dragDrop.handleDragEnd(element)
}

const handleTaskDragOver = (event, index) => {
  event.stopPropagation()
  dragDrop.handleDragOver(event, props.column.id, index)
}

const handleColumnDragOver = (event) => {
  event.preventDefault()
  dragDrop.handleColumnDragOver(event, props.column.id, props.column.tasks.length)
}

const handleEmptyDragOver = (event) => {
  dragDrop.handleEmptyColumnDragOver(event, props.column.id)
}

const handleColumnDrop = (event) => {
  dragDrop.handleDrop(event, props.column.id, (moveData) => {
    emit('task-move', moveData)
  })
}

const forceUpdate = () => {
  if (scroller.value) {
    scroller.value.forceUpdate()
  }
}

defineExpose({
  forceUpdate,
  scroller
})
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
  border: 2px dashed rgba(99, 102, 241, 0.6);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Source placeholder - same style but slightly different to differentiate */
.source-placeholder {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.03);
}

.placeholder-inner {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(99, 102, 241, 0.0) 0%,
    rgba(99, 102, 241, 0.2) 50%,
    rgba(99, 102, 241, 0.0) 100%
  );
  animation: shimmer 1.5s infinite;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.placeholder-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.placeholder-fade-enter-from,
.placeholder-fade-leave-to {
  opacity: 0;
  transform: scaleY(0.5);
}

.empty-drop-zone {
  min-height: 200px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
  color: #64748b;
  font-size: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

:deep(.vue-recycle-scroller__item-wrapper) {
  width: 100%;
}

:deep(.vue-recycle-scroller__item-view) {
  width: 100%;
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