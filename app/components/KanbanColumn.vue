<template>
  <div 
    class="task-column" 
    :data-column="column.id"
    @dragover="$emit('dragover', $event, column.id)"
    @drop="$emit('drop', $event, column.id)"
  >
    <div class="column-header">
      <h2>{{ column.title }}</h2>
      <span class="task-count">{{ column.tasks.length }}</span>
    </div>
    <ul class="tasks" :ref="el => $emit('set-ref', el, column.id)">
      <KanbanTask
        v-for="task in column.tasks" 
        :key="task.id"
        :task="task"
        @dragstart="$emit('task-dragstart', $event, task, column.id)"
        @dragend="$emit('task-dragend', $event)"
        @dragenter="$emit('task-dragenter', $event)"
        @dragover="$emit('task-dragover', $event)"
      />
    </ul>
  </div>
</template>

<script setup>
defineProps({
  column: {
    type: Object,
    required: true
  }
});

defineEmits(['dragover', 'drop', 'set-ref', 'task-dragstart', 'task-dragend', 'task-dragenter', 'task-dragover']);
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

.tasks {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  margin: -4px;
  min-height: 100px;
  position: relative;
}

.tasks::-webkit-scrollbar {
  width: 6px;
}

.tasks::-webkit-scrollbar-track {
  background: transparent;
}

.tasks::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.tasks::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Empty state */
.tasks:empty::before {
  content: "Drop tasks here";
  display: block;
  text-align: center;
  color: #64748b;
  padding: 30px 20px;
  font-size: 0.9rem;
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
