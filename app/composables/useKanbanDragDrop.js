import { ref } from 'vue'

export function useKanbanDragDrop() {
  // ============ STATE ============
  const isDragging = ref(false)
  const draggedTask = ref(null)
  const sourceColumnId = ref(null)
  const sourceIndex = ref(null)
  const placeholderHeight = ref(80)

  // Custom drag preview
  const customDragElement = ref(null)
  const dragOffset = ref({ x: 0, y: 0 })

  // Drop target
  const dropTargetColumnId = ref(null)
  const dropTargetIndex = ref(null)

  // ============ NON-REACTIVE COORDS ============
  let mouseX = 0
  let mouseY = 0
  let rafPending = false

  let dragMoveListener = null
  let dragSourceElement = null

  const applyPreviewTransform = () => {
    const el = customDragElement.value
    if (!el) return
    const x = mouseX - dragOffset.value.x
    const y = mouseY - dragOffset.value.y
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  const schedulePreviewMove = () => {
    if (rafPending) return
    rafPending = true

    requestAnimationFrame(() => {
      rafPending = false
      applyPreviewTransform()
    })
  }

  const cleanupPreviewAndListeners = () => {
    if (dragSourceElement && dragMoveListener) {
      dragSourceElement.removeEventListener('drag', dragMoveListener)
    }
    dragMoveListener = null
    dragSourceElement = null

    if (customDragElement.value) {
      customDragElement.value.remove()
      customDragElement.value = null
    }

    rafPending = false
  }

  // ============ DRAG START ============
  const handleDragStart = (event, task, columnId, index, element) => {
    draggedTask.value = { ...task }
    sourceColumnId.value = columnId
    sourceIndex.value = index

    dropTargetColumnId.value = columnId
    dropTargetIndex.value = index

    if (element) {
      const rect = element.getBoundingClientRect()
      placeholderHeight.value = rect.height
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)

    mouseX = event.clientX
    mouseY = event.clientY

    if (element) {
      const rect = element.getBoundingClientRect()

      dragOffset.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }

      const clone = element.cloneNode(true)
      clone.style.position = 'fixed'
      clone.style.left = '0px'
      clone.style.top = '0px'
      clone.style.width = `${rect.width}px`
      clone.style.opacity = '1'
      clone.style.borderRadius = '7px'
      clone.style.pointerEvents = 'none'
      clone.style.zIndex = '10000'
      clone.style.background = '#22232F'
      clone.style.border = '1px solid rgba(255, 255, 255, 0.15)'
      clone.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)'
      clone.style.transition = 'none'
      clone.style.willChange = 'transform'
      clone.style.contain = 'paint'

      customDragElement.value = clone
      document.body.appendChild(clone)

      applyPreviewTransform()

      // Hide default drag image
      const img = new Image()
      img.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      event.dataTransfer.setDragImage(img, 0, 0)

      // Track movement via dragged element's "drag"
      dragSourceElement = element
      dragMoveListener = (e) => {
        if (e.clientX !== 0 && e.clientY !== 0) {
          mouseX = e.clientX
          mouseY = e.clientY
          schedulePreviewMove()
        }
      }
      dragSourceElement.addEventListener('drag', dragMoveListener)

      const cleanupDragElement = () => {
        cleanupPreviewAndListeners()
        document.removeEventListener('dragend', cleanupDragElement)
        document.removeEventListener('drop', cleanupDragElement)
      }

      document.addEventListener('dragend', cleanupDragElement, { once: true })
      document.addEventListener('drop', cleanupDragElement, { once: true })
    }

    requestAnimationFrame(() => {
      isDragging.value = true
      document.body.classList.add('is-dragging')
    })
  }

  // ============ DRAG OVER ============
  const handleDragOver = (event, columnId, taskIndex) => {
    if (!isDragging.value) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    // Secondary movement tracking (helps some browsers)
    if (event.clientX !== 0 && event.clientY !== 0) {
      mouseX = event.clientX
      mouseY = event.clientY
      schedulePreviewMove()
    }

    if (dropTargetColumnId.value !== columnId || dropTargetIndex.value !== taskIndex) {
      dropTargetColumnId.value = columnId
      dropTargetIndex.value = taskIndex
    }
  }

  // ============ DROP ============
  const handleDrop = (event, columnId, onMove) => {
    if (!isDragging.value || !draggedTask.value) return
    event.preventDefault()

    const targetCol = dropTargetColumnId.value || columnId
    const targetIdx = dropTargetIndex.value ?? 0
    const srcCol = sourceColumnId.value
    const srcIdx = sourceIndex.value

    if (onMove) {
      onMove({
        task: draggedTask.value,
        sourceColumnId: srcCol,
        sourceColumnIndex: srcIdx,
        targetColumnId: targetCol,
        targetIndex: targetIdx
      })
    }

    resetDragState()
  }

  const handleDragEnd = () => {
    resetDragState()
  }

  const resetDragState = () => {
    cleanupPreviewAndListeners()

    isDragging.value = false
    draggedTask.value = null
    sourceColumnId.value = null
    sourceIndex.value = null
    dropTargetColumnId.value = null
    dropTargetIndex.value = null

    document.body.classList.remove('is-dragging')
  }

  // The following are kept for compatibility, even if you no longer rely on them.
  const getTaskTransform = () => null

  const isDraggedTask = (taskId) => {
    return isDragging.value && draggedTask.value?.id === taskId
  }

  const shouldShowPlaceholder = (columnId, index) => {
    if (!isDragging.value) return false
    return dropTargetColumnId.value === columnId && dropTargetIndex.value === index
  }

  return {
    isDragging,
    draggedTask,
    sourceColumnId,
    sourceIndex,
    dropTargetColumnId,
    dropTargetIndex,
    placeholderHeight,

    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    resetDragState,

    getTaskTransform,
    isDraggedTask,
    shouldShowPlaceholder
  }
}
