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
          :size-dependencies="[item.title, item.priority]"
          :data-index="index"
        >
          <!-- Placeholder before task -->
          <transition name="placeholder-fade">
            <div 
              v-if="shouldShowPlaceholder(index)"
              class="task-placeholder"
              :style="{ height: `${dragDrop.placeholderHeight.value}px` }"
            >
              <div class="placeholder-inner"></div>
            </div>
          </transition>

          <!-- Task (hidden when being dragged) -->
          <!-- <div 
            v-if="!isTaskBeingDragged(item.id)"
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
          </div> -->

          <div 
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
              v-if="shouldShowPlaceholderAfter(index)"
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
import { ref, inject, onMounted, onUnmounted } from 'vue'
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



// Show placeholder at drop position
const shouldShowPlaceholder = (index) => {
  return dragDrop.isDragging.value && 
         dragDrop.dropTargetColumnId.value === props.column.id && 
         dragDrop.dropTargetIndex.value === index
}

// Show placeholder after last task
const shouldShowPlaceholderAfter = (index) => {
  const isLast = index === props.column.tasks.length - 1
  return dragDrop.isDragging.value && 
         isLast && 
         dragDrop.dropTargetColumnId.value === props.column.id && 
         dragDrop.dropTargetIndex.value > index
}

const handleTaskDragStart = (event, task, index) => {
  const element = event.target.closest('.task')
  if (!element) return
  
  dragDrop.handleDragStart(event, task, props.column.id, index, element)
}

const handleTaskDragEnd = () => {
  dragDrop.handleDragEnd()
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

// ESC key to cancel drag
let escapeHandler = null

onMounted(() => {
  escapeHandler = (e) => {
    if (e.key === 'Escape' && dragDrop.isDragging.value) {
      console.log('[ESC] Cancelling drag')
      dragDrop.resetDragState()
    }
  }
  window.addEventListener('keydown', escapeHandler)
})

onUnmounted(() => {
  if (escapeHandler) {
    window.removeEventListener('keydown', escapeHandler)
  }
})

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
    rgba(99, 102, 241, 0.0) 0%,
    rgba(99, 102, 241, 0.3) 50%,
    rgba(99, 102, 241, 0.0) 100%
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
  min-height: 200px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
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