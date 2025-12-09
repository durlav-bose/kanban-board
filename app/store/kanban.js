import { defineStore } from 'pinia'

export const useKanbanStore = defineStore('kanban', {
  state: () => ({
    columns: [],
    tasks: [],
    loading: false,
    draggedTask: null,
    sourceColumn: null,
  }),

  getters: {
    // Get tasks grouped by column
    tasksByColumn: (state) => {
      const grouped = {}
      state.columns.forEach(column => {
        grouped[column.id] = state.tasks
          .filter(task => task.columnId === column.id)
          .sort((a, b) => a.position - b.position)
      })
      return grouped
    },

    // Get total task count
    totalTasks: (state) => state.tasks.length,

    // Get column by ID
    getColumnById: (state) => (columnId) => {
      return state.columns.find(col => col.id === columnId)
    },

    // Get task by ID
    getTaskById: (state) => (taskId) => {
      return state.tasks.find(task => task.id === taskId)
    },
  },

  actions: {
    // Initialize board data
    async initializeBoard(boardId) {
      this.loading = true
      try {
        // Fetch from API
        const { data } = await $fetch(`/api/boards/${boardId}`)
        this.columns = data.columns
        this.tasks = data.tasks
      } catch (error) {
        console.error('Failed to load board:', error)
      } finally {
        this.loading = false
      }
    },

    // Add a new task
    async addTask(columnId, taskData) {
      const newTask = {
        id: `task-${Date.now()}`,
        columnId,
        position: this.tasksByColumn[columnId]?.length || 0,
        createdAt: new Date().toISOString(),
        ...taskData,
      }

      this.tasks.push(newTask)

      // Sync with backend
      try {
        await $fetch('/api/tasks', {
          method: 'POST',
          body: newTask,
        })
      } catch (error) {
        console.error('Failed to create task:', error)
        // Rollback on error
        const index = this.tasks.findIndex(t => t.id === newTask.id)
        if (index > -1) this.tasks.splice(index, 1)
      }

      return newTask
    },

    // Move task between columns
    async moveTask(taskId, targetColumnId, targetPosition) {
      const task = this.getTaskById(taskId)
      if (!task) return

      const oldColumnId = task.columnId
      const oldPosition = task.position

      // Optimistic update
      task.columnId = targetColumnId
      task.position = targetPosition

      // Reorder tasks in both columns
      this.reorderTasks(oldColumnId)
      this.reorderTasks(targetColumnId)

      // Sync with backend
      try {
        await $fetch(`/api/tasks/${taskId}/move`, {
          method: 'PATCH',
          body: {
            columnId: targetColumnId,
            position: targetPosition,
          },
        })
      } catch (error) {
        console.error('Failed to move task:', error)
        // Rollback on error
        task.columnId = oldColumnId
        task.position = oldPosition
        this.reorderTasks(oldColumnId)
        this.reorderTasks(targetColumnId)
      }
    },

    // Update task
    async updateTask(taskId, updates) {
      const task = this.getTaskById(taskId)
      if (!task) return

      const oldData = { ...task }
      Object.assign(task, updates)

      try {
        await $fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: updates,
        })
      } catch (error) {
        console.error('Failed to update task:', error)
        Object.assign(task, oldData)
      }
    },

    // Delete task
    async deleteTask(taskId) {
      const task = this.getTaskById(taskId)
      if (!task) return

      const index = this.tasks.findIndex(t => t.id === taskId)
      const columnId = task.columnId

      // Remove from array
      this.tasks.splice(index, 1)

      // Reorder remaining tasks
      this.reorderTasks(columnId)

      try {
        await $fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        })
      } catch (error) {
        console.error('Failed to delete task:', error)
        // Rollback on error
        this.tasks.splice(index, 0, task)
        this.reorderTasks(columnId)
      }
    },

    // Reorder tasks in a column
    reorderTasks(columnId) {
      const columnTasks = this.tasks
        .filter(t => t.columnId === columnId)
        .sort((a, b) => a.position - b.position)

      columnTasks.forEach((task, index) => {
        task.position = index
      })
    },

    // Add column
    async addColumn(columnData) {
      const newColumn = {
        id: `column-${Date.now()}`,
        position: this.columns.length,
        ...columnData,
      }

      this.columns.push(newColumn)

      try {
        await $fetch('/api/columns', {
          method: 'POST',
          body: newColumn,
        })
      } catch (error) {
        console.error('Failed to create column:', error)
        const index = this.columns.findIndex(c => c.id === newColumn.id)
        if (index > -1) this.columns.splice(index, 1)
      }

      return newColumn
    },

    // Set drag state
    setDragState(task, sourceColumn) {
      this.draggedTask = task
      this.sourceColumn = sourceColumn
    },

    // Clear drag state
    clearDragState() {
      this.draggedTask = null
      this.sourceColumn = null
    },

    // Bulk operations for performance
    async bulkUpdateTasks(updates) {
      const oldData = new Map()

      // Store old data and apply updates
      updates.forEach(({ taskId, data }) => {
        const task = this.getTaskById(taskId)
        if (task) {
          oldData.set(taskId, { ...task })
          Object.assign(task, data)
        }
      })

      try {
        await $fetch('/api/tasks/bulk', {
          method: 'PATCH',
          body: updates,
        })
      } catch (error) {
        console.error('Failed bulk update:', error)
        // Rollback all changes
        oldData.forEach((data, taskId) => {
          const task = this.getTaskById(taskId)
          if (task) Object.assign(task, data)
        })
      }
    },
  },
})