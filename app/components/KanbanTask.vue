<template>
  <div 
    class="task"
    :class="{ 'dragging': isDragging }"
    :data-task-id="task.id"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragover="$emit('dragover', $event)"
  >
    <div class="task-content">
      <span class="task-title">{{ task.title }}</span>
      <span class="task-meta">Priority: {{ task.priority }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  task: {
    type: Object,
    required: true
  },
  isDragging: {
    type: Boolean,
    default: false
  }
})

defineEmits(['dragstart', 'dragend', 'dragover'])
</script>

<style scoped>
.task {
  background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  border: 2px solid #475569;
  border-radius: 8px;
  padding: 16px;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.task:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
  background: linear-gradient(135deg, #3b4d65 0%, #242e3f 100%);
  transform: translateY(-2px);
}

.task:active {
  cursor: grabbing;
}

.task.dragging {
  opacity: 0.3;
  transform: scale(0.95);
  cursor: grabbing;
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.task-title {
  font-weight: 500;
  color: #f1f5f9;
  font-size: 0.95rem;
  line-height: 1.4;
}

.task-meta {
  font-size: 0.8rem;
  color: #94a3b8;
}
</style>