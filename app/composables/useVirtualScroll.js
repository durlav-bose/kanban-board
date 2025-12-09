import { ref, computed } from 'vue'

export const useVirtualScroll = (options = {}) => {
  const {
    minItemSize = 100,
    buffer = 200,
    pageMode = false,
  } = options

  // Scroller refs
  const scrollerRefs = ref(new Map())

  // Register a scroller
  const registerScroller = (id, scrollerInstance) => {
    scrollerRefs.value.set(id, scrollerInstance)
  }

  // Unregister a scroller
  const unregisterScroller = (id) => {
    scrollerRefs.value.delete(id)
  }

  // Scroll to item in a specific scroller
  const scrollToItem = (scrollerId, index) => {
    const scroller = scrollerRefs.value.get(scrollerId)
    if (scroller && scroller.$el) {
      scroller.scrollToItem(index)
    }
  }

  // Get visible items range
  const getVisibleRange = (scrollerId) => {
    const scroller = scrollerRefs.value.get(scrollerId)
    if (scroller) {
      return {
        start: scroller.startIndex,
        end: scroller.endIndex,
      }
    }
    return null
  }

  // Force update scroller
  const forceUpdate = (scrollerId) => {
    const scroller = scrollerRefs.value.get(scrollerId)
    if (scroller && scroller.$el) {
      scroller.forceUpdate()
    }
  }

  // Calculate item size based on content
  const calculateItemSize = (item, options = {}) => {
    const {
      baseHeight = 80,
      titleLineHeight = 20,
      metaHeight = 16,
      padding = 32,
    } = options

    let height = baseHeight + padding

    // Add height based on title length (rough estimation)
    if (item.title) {
      const titleLines = Math.ceil(item.title.length / 40)
      height += titleLines * titleLineHeight
    }

    // Add height for metadata
    if (item.priority || item.meta) {
      height += metaHeight
    }

    return height
  }

  return {
    minItemSize,
    buffer,
    pageMode,
    scrollerRefs,
    registerScroller,
    unregisterScroller,
    scrollToItem,
    getVisibleRange,
    forceUpdate,
    calculateItemSize,
  }
}

// Performance optimization composable
export const useVirtualScrollPerformance = () => {
  // Debounce function for scroll events
  const debounce = (func, wait) => {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // Throttle function for frequent updates
  const throttle = (func, limit) => {
    let inThrottle
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }

  // Check if element is in viewport
  const isInViewport = (element) => {
    if (!element) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  return {
    debounce,
    throttle,
    isInViewport,
  }
}