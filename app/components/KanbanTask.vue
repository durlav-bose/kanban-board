<template>
  <div 
    class="task"
    :data-task-id="task.id"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <div class="task-content">
      <div class="task-header">
        <span class="task-title">{{ task.title }}</span>
        <span 
          class="task-priority" 
          :class="`priority-${task.priority.toLowerCase()}`"
        >
          {{ task.priority }}
        </span>
      </div>
      <p v-if="task.description" class="task-description">
        {{ task.description }}
      </p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

defineEmits(['dragstart', 'dragend'])
</script>

<style scoped>
.task {
  min-height: 80px;
  height: auto;
  box-sizing: border-box;
  background: #22232F;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 7px;
  padding: 12px;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  user-select: none;
  display: flex;
  flex-direction: column;
  
  /* Smooth transitions for all interactive states */
  transition: background 0.2s ease;
}

/* Hover - subtle lift effect */
.task:hover {
  background: #262735;
}

/* Active/Grabbing - make task fully visible when dragging */
.task:active {
  cursor: grabbing;
  border-color: rgba(255, 255, 255, 0.15);
  background: #22232F;
  opacity: 1 !important;
  z-index: 10000;
}

.task-content {
  pointer-events: none;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.task-title {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.9rem;
  line-height: 1.3;
  flex: 1;
  word-wrap: break-word;
}

.task-priority {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.task:hover .task-priority {
  transform: scale(1.05);
}

.priority-high {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.priority-medium {
  background: rgba(251, 191, 36, 0.2);
  color: #fcd34d;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.priority-low {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.priority-critical {
  background: rgba(220, 38, 38, 0.2);
  color: #f87171;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.task-description {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>