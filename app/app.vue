<template>
  <div>
    <div class="board-header">
      <h1>📋 Kanban Board</h1>
    </div>
    
    <div class="container">
      <div 
        v-for="column in columns" 
        :key="column.id" 
        class="task-column" 
        :data-column="column.id"
        @dragover="handleColumnDragOver($event, column.id)"
        @drop="handleDrop($event, column.id)"
      >
        <div class="column-header">
          <h2>{{ column.title }}</h2>
          <span class="task-count">{{ column.tasks.length }}</span>
        </div>
        <ul class="tasks" :ref="el => setTasksRef(el, column.id)">
          <li 
            v-for="(task, index) in column.tasks" 
            :key="task.id"
            class="task"
            :data-task-id="task.id"
            draggable="true"
            @dragstart="handleDragStart($event, task, column.id)"
            @dragend="handleDragEnd"
            @dragenter="handleDragEnter"
            @dragover="handleTaskDragOver"
          >
            <div class="task-content">
              <span class="task-title">{{ task.title }}</span>
              <span class="task-meta">Priority: {{ task.priority }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, shallowRef } from 'vue';

// Use regular variables instead of refs for DOM manipulation
let draggedCard = null;
let placeholderElement = null;
let isDragging = false;

const tasksRefs = {};
const columns = shallowRef([
  {
    id: 'todo',
    title: '📝 To Do',
    tasks: [
      { id: 1, title: 'Design new landing page', priority: 'High' },
      { id: 2, title: 'Update documentation', priority: 'Medium' },
      { id: 3, title: 'Review pull requests', priority: 'High' }
    ]
  },
  {
    id: 'in-progress',
    title: '🚀 In Progress',
    tasks: [
      { id: 4, title: 'Implement authentication system', priority: 'High' },
      { id: 5, title: 'Optimize database queries', priority: 'Medium' }
    ]
  },
  {
    id: 'review',
    title: '👀 Review',
    tasks: [
      { id: 6, title: 'API integration testing', priority: 'High' }
    ]
  },
  {
    id: 'done',
    title: '✅ Done',
    tasks: [
      { id: 7, title: 'Setup CI/CD pipeline', priority: 'High' },
      { id: 8, title: 'Create project structure', priority: 'Medium' }
    ]
  }
]);

function setTasksRef(el, columnId) {
  if (el) {
    tasksRefs[columnId] = el;
  }
}

function createPlaceholder(height) {
  const ph = document.createElement('li');
  ph.className = 'task placeholder';
  ph.style.height = height + 'px';
  return ph;
}

function getClosestTask(container, y) {
  const tasks = [...container.querySelectorAll('.task:not(.placeholder):not(.is-dragging)')];
  
  return tasks.reduce((closest, task) => {
    const box = task.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: task };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleDragStart(e, task, columnId) {
  isDragging = true;
  draggedCard = e.target;
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.innerHTML);
  
  const cardHeight = e.target.offsetHeight;
  
  // Create a drag image with full opacity
  const dragImage = e.target.cloneNode(true);
  dragImage.classList.remove('is-dragging');
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-9999px';
  dragImage.style.left = '-9999px';
  dragImage.style.width = e.target.offsetWidth + 'px';
  dragImage.style.opacity = '1';
  // dragImage.style.transform = 'rotate(3deg)';
  // dragImage.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.3)';
  dragImage.style.border = '2px solid #667eea';
  // dragImage.style.backgroundColor = 'white';
  dragImage.style.zIndex = '9999';
  document.body.appendChild(dragImage);
  
  e.dataTransfer.setDragImage(dragImage, e.target.offsetWidth / 2, e.target.offsetHeight / 2);
  
  setTimeout(() => {
    if (document.body.contains(dragImage)) {
      document.body.removeChild(dragImage);
    }
  }, 0);
  
  // Hide the dragged card and create placeholder
  setTimeout(() => {
    if (draggedCard && document.body.contains(draggedCard)) {
      draggedCard.classList.add('is-dragging');
      placeholderElement = createPlaceholder(cardHeight);
      draggedCard.parentNode.insertBefore(placeholderElement, draggedCard);
    }
  }, 0);
}

function handleDragEnd(e) {
  if (!e.target) return;
  
  if (e.target.classList) {
    e.target.classList.remove('is-dragging');
  }
  
  if (placeholderElement && placeholderElement.parentNode) {
    placeholderElement.remove();
  }
  placeholderElement = null;
  
  // Small delay before clearing drag state and syncing
  setTimeout(() => {
    isDragging = false;
    draggedCard = null;
  }, 100);
}

function handleDragEnter(e) {
  if (!draggedCard) return;
  const target = e.target.closest('.task');
  if (!target || target === draggedCard || target.classList.contains('placeholder')) return;
  e.preventDefault();
}

function handleTaskDragOver(e) {
  if (!draggedCard || !placeholderElement) return;
  
  const target = e.target.closest('.task');
  if (!target || target === draggedCard || target.classList.contains('placeholder')) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const container = target.closest('.tasks');
  if (!container) return;
  
  // Get all tasks before moving
  const allTasks = [...container.querySelectorAll('.task:not(.placeholder)')];
  const oldPositions = new Map();
  allTasks.forEach(task => {
    oldPositions.set(task, task.getBoundingClientRect().top);
  });
  
  const rect = target.getBoundingClientRect();
  const midPoint = rect.top + rect.height / 2;
  
  // Determine if we're in top or bottom half
  if (e.clientY < midPoint) {
    // Top half - insert before this card
    if (target.previousElementSibling !== placeholderElement) {
      container.insertBefore(placeholderElement, target);
    }
  } else {
    // Bottom half - insert after this card
    const next = target.nextElementSibling;
    if (next !== placeholderElement) {
      container.insertBefore(placeholderElement, target.nextElementSibling);
    }
  }
  
  // Animate tasks that moved
  allTasks.forEach(task => {
    if (task === draggedCard) return;
    const oldPos = oldPositions.get(task);
    const newPos = task.getBoundingClientRect().top;
    const delta = oldPos - newPos;
    
    if (delta !== 0) {
      task.style.transform = `translateY(${delta}px)`;
      task.style.transition = 'none';
      
      requestAnimationFrame(() => {
        task.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        task.style.transform = 'translateY(0)';
      });
    }
  });
}

function handleColumnDragOver(e, columnId) {
  if (!draggedCard || !placeholderElement) return;
  
  e.preventDefault();
  
  const tasksContainer = tasksRefs[columnId];
  if (!tasksContainer) return;
  
  // Get all tasks before moving
  const allTasks = [...tasksContainer.querySelectorAll('.task:not(.placeholder)')];
  const oldPositions = new Map();
  allTasks.forEach(task => {
    oldPositions.set(task, task.getBoundingClientRect().top);
  });
  
  // Get the element after cursor position
  const afterElement = getClosestTask(tasksContainer, e.clientY);
  
  if (afterElement == null) {
    // Append to end
    tasksContainer.appendChild(placeholderElement);
  } else {
    // Insert before the element
    tasksContainer.insertBefore(placeholderElement, afterElement);
  }
  
  // Animate tasks that moved
  allTasks.forEach(task => {
    if (task === draggedCard) return;
    const oldPos = oldPositions.get(task);
    const newPos = task.getBoundingClientRect().top;
    const delta = oldPos - newPos;
    
    if (delta !== 0) {
      task.style.transform = `translateY(${delta}px)`;
      task.style.transition = 'none';
      
      requestAnimationFrame(() => {
        task.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        task.style.transform = 'translateY(0)';
      });
    }
  });
}

function handleDrop(e, columnId) {
  e.stopPropagation();
  e.preventDefault();
  
  if (!draggedCard || !placeholderElement) return false;
  
  const tasksContainer = tasksRefs[columnId];
  if (!tasksContainer) return false;
  
  // Insert the dragged card at placeholder position
  if (placeholderElement.parentNode) {
    tasksContainer.insertBefore(draggedCard, placeholderElement);
  } else {
    tasksContainer.appendChild(draggedCard);
  }
  
  // Remove dragging class
  if (draggedCard.classList) {
    draggedCard.classList.remove('is-dragging');
  }
  
  // Remove placeholder
  if (placeholderElement && placeholderElement.parentNode) {
    placeholderElement.remove();
  }
  placeholderElement = null;
  
  // Sync data after drop
  setTimeout(() => {
    syncDataFromDOM();
    isDragging = false;
    draggedCard = null;
  }, 50);
  
  return false;
}

function syncDataFromDOM() {
  if (isDragging) return; // Don't sync while dragging
  
  // Create a new columns array to trigger reactivity
  const newColumns = columns.value.map(column => {
    const container = tasksRefs[column.id];
    if (!container) return column;
    
    const taskElements = container.querySelectorAll('.task:not(.placeholder):not(.is-dragging)');
    const newTasks = [];
    
    taskElements.forEach(taskEl => {
      const taskId = parseInt(taskEl.getAttribute('data-task-id'));
      // Find task in any column
      for (const col of columns.value) {
        const task = col.tasks.find(t => t.id === taskId);
        if (task) {
          newTasks.push(task);
          break;
        }
      }
    });
    
    return { ...column, tasks: newTasks };
  });
  
  columns.value = newColumns;
}

onMounted(() => {
  // Initial sync
  nextTick(() => {
    console.log('Kanban board mounted');
  });
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  min-height: 100vh;
  padding: 20px;
}

.board-header {
  text-align: center;
  margin-bottom: 30px;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.board-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
}

.container {
  display: flex;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 10px;
}

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

/* Dragging state - completely hide the card, only placeholder shows */
.task.is-dragging {
  opacity: 0 !important;
  height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  overflow: hidden !important;
  pointer-events: none !important;
  transition: none !important;
}

/* Placeholder - empty dashed box that shows where card will drop */
.task.placeholder {
  background: rgba(51, 65, 85, 0.5) !important;
  border: 2px dashed #6366f1 !important;
  cursor: default !important;
  pointer-events: none;
  transition: all 0.2s ease !important;
  box-shadow: none !important;
  animation: placeholderPulse 1.5s ease-in-out infinite;
}

@keyframes placeholderPulse {
  0%, 100% {
    border-color: #6366f1;
    opacity: 1;
  }
  50% {
    border-color: #8b5cf6;
    opacity: 0.7;
  }
}

.task.placeholder * {
  display: none;
}

.task.placeholder:hover {
  box-shadow: none !important;
  border-color: #6366f1 !important;
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

/* Mobile responsive */
@media (max-width: 1024px) {
  .container {
    gap: 15px;
  }
  
  .task-column {
    min-width: 240px;
  }
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
  
  .task-column {
    max-height: none;
  }
  
  .board-header h1 {
    font-size: 1.8rem;
  }
}
</style>
