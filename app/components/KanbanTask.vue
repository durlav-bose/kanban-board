<template>
  <li 
    class="task"
    :data-task-id="task.id"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragenter="$emit('dragenter', $event)"
    @dragover="$emit('dragover', $event)"
  >
    <div class="task-content">
      <span class="task-title">{{ task.title }}</span>
      <span class="task-meta">Priority: {{ task.priority }}</span>
    </div>
  </li>
</template>

<script setup>
defineProps({
  task: {
    type: Object,
    required: true
  }
});

defineEmits(['dragstart', 'dragend', 'dragenter', 'dragover']);
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
  will-change: transform;
  position: relative;
}

.task:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
  background: linear-gradient(135deg, #3b4d65 0%, #242e3f 100%);
}

.task:active {
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
