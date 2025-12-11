<template>
  <div 
    class="task"
    :data-task-id="task.id"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragover="$emit('dragover', $event)"
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
defineProps({
  task: {
    type: Object,
    required: true
  }
})

defineEmits(['dragstart', 'dragend', 'dragover'])
</script>

<style scoped>
.task {
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border: 2px solid #475569;
  border-radius: 10px;
  padding: 16px;
  cursor: grab;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  user-select: none;
  position: relative;
  opacity: 1;
  /* Linear-style smooth transition */
  transition: transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94), 
              box-shadow 150ms ease, 
              border-color 150ms ease;
}

.task:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  background: linear-gradient(135deg, #3b4d65 0%, #242e3f 100%);
  transform: translateY(-1px);
}

.task:active {
  cursor: grabbing;
  transform: scale(1.02);
}

.task-content {
  pointer-events: none;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.task-title {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 1;
}

.task-priority {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
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

.task-description {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.4;
  margin: 0;
}
</style>