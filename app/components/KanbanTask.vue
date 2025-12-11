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
  /* Allow dynamic height based on content */
  min-height: 80px;
  height: auto;
  box-sizing: border-box;
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border: 1px solid #475569;
  border-radius: 8px;
  padding: 12px;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  user-select: none;
  display: flex;
  flex-direction: column;
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.task:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}

.task:active {
  cursor: grabbing;
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
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
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>