import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import classNames from 'classnames'
import { SplitPanelProps } from './types'
import styles from './SplitPanel.module.scss'

// --- Helper functions for size calculations
const parseSize = (size: string | number | undefined, containerSize: number): number => {
  if (size === undefined) return 0
  if (typeof size === 'number') return size
  if (typeof size === 'string') {
    if (size.endsWith('%')) {
      const percentage = parseFloat(size.slice(0, -1))
      return (percentage / 100) * containerSize
    }
    if (size.endsWith('px')) {
      return parseFloat(size.slice(0, -2))
    }
    return parseFloat(size)
  }
  return 0
}

const formatSize = (size: number): string => `${size}px`

const SplitPanel: React.FC<SplitPanelProps> = ({
  children,
  className,
  'data-testid': dataTestId,
  primaryLocation,
  primaryVisible = true,
  secondaryVisible = true,
  initialPrimarySize = '50%',
  minPrimarySize = 100,
  minSecondarySize = 100,
  onUpdatePrimarySize,
  onPrimarySizeUpdateCompleted,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [primarySize, setPrimarySize] = useState<number>(0)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // --- Determine orientation and calculations
  const isHorizontal = primaryLocation === 'left' || primaryLocation === 'right'
  const isPrimaryFirst = primaryLocation === 'left' || primaryLocation === 'top'
  
  // --- Calculate effective sizes
  const relevantContainerSize = isHorizontal ? containerSize.width : containerSize.height
  const minPrimarySizePx = parseSize(minPrimarySize, relevantContainerSize)
  const minSecondarySizePx = parseSize(minSecondarySize, relevantContainerSize)
  
  // --- Initialize primary size
  useEffect(() => {
    if (relevantContainerSize > 0 && primarySize === 0) {
      const initialSize = parseSize(initialPrimarySize, relevantContainerSize)
      const clampedSize = Math.max(
        minPrimarySizePx,
        Math.min(initialSize, relevantContainerSize - minSecondarySizePx)
      )
      setPrimarySize(clampedSize)
    }
  }, [relevantContainerSize, initialPrimarySize, minPrimarySizePx, minSecondarySizePx, primarySize])

  // --- Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // --- Calculate splitter position
  const splitterPosition = useMemo(() => {
    if (!primaryVisible || !secondaryVisible) return 0
    return isPrimaryFirst ? primarySize : relevantContainerSize - primarySize
  }, [primaryVisible, secondaryVisible, isPrimaryFirst, primarySize, relevantContainerSize])

  // --- Handle mouse down on splitter
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startPosition = isHorizontal ? e.clientX : e.clientY
    const startSize = primarySize

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      
      const currentPosition = isHorizontal ? e.clientX : e.clientY
      const delta = currentPosition - startPosition
      
      let newSize: number
      if (isPrimaryFirst) {
        newSize = startSize + delta
      } else {
        newSize = startSize - delta
      }

      // --- Clamp size to constraints
      const clampedSize = Math.max(
        minPrimarySizePx,
        Math.min(newSize, relevantContainerSize - minSecondarySizePx)
      )

      setPrimarySize(clampedSize)
      onUpdatePrimarySize?.(clampedSize)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      onPrimarySizeUpdateCompleted?.(primarySize)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [
    isHorizontal,
    isPrimaryFirst,
    primarySize,
    minPrimarySizePx,
    minSecondarySizePx,
    relevantContainerSize,
    onUpdatePrimarySize,
    onPrimarySizeUpdateCompleted
  ])

  // --- Get children
  const childrenArray = React.Children.toArray(children)
  const primaryChild = childrenArray[0]
  const secondaryChild = childrenArray[1]

  // --- Calculate panel styles
  const primaryPanelStyle: React.CSSProperties = {
    display: primaryVisible ? 'block' : 'none',
    [isHorizontal ? 'width' : 'height']: formatSize(primarySize),
    [isHorizontal ? 'height' : 'width']: '100%'
  }

  const secondaryPanelStyle: React.CSSProperties = {
    display: secondaryVisible ? 'block' : 'none',
    [isHorizontal ? 'width' : 'height']: formatSize(relevantContainerSize - primarySize),
    [isHorizontal ? 'height' : 'width']: '100%'
  }

  // --- Calculate splitter style
  const shouldShowSplitter = primaryVisible && secondaryVisible
  const splitterStyle: React.CSSProperties = {
    [isHorizontal ? 'left' : 'top']: formatSize(splitterPosition - 2),
    display: shouldShowSplitter ? 'block' : 'none'
  }

  // --- Render panels in correct order
  const panels = isPrimaryFirst 
    ? [
        primaryChild && (
          <div key="primary" className={styles.primaryPanel} style={primaryPanelStyle} data-testid="primary-panel">
            {primaryChild}
          </div>
        ),
        secondaryChild && (
          <div key="secondary" className={styles.secondaryPanel} style={secondaryPanelStyle} data-testid="secondary-panel">
            {secondaryChild}
          </div>
        )
      ]
    : [
        secondaryChild && (
          <div key="secondary" className={styles.secondaryPanel} style={secondaryPanelStyle} data-testid="secondary-panel">
            {secondaryChild}
          </div>
        ),
        primaryChild && (
          <div key="primary" className={styles.primaryPanel} style={primaryPanelStyle} data-testid="primary-panel">
            {primaryChild}
          </div>
        )
      ]

  return (
    <div
      ref={containerRef}
      className={classNames(
        styles.splitPanel,
        {
          [styles.horizontal]: isHorizontal,
          [styles.vertical]: !isHorizontal,
          [styles.userSelecting]: isDragging
        },
        className
      )}
      style={style}
      data-testid={dataTestId}
    >
      {panels}
      <div
        className={classNames(styles.splitter, {
          [styles.horizontal]: isHorizontal,
          [styles.vertical]: !isHorizontal,
          [styles.dragging]: isDragging
        })}
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        data-testid="splitter"
      />
    </div>
  )
}

export default SplitPanel
