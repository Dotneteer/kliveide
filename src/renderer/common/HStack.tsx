import React from 'react'
import classNames from 'classnames'
import { Stack, BaseStackProps } from './Stack'
import styles from './HStack.module.scss'

interface HStackProps extends BaseStackProps {}

/**
 * HStack - A horizontal flex container for arranging items in a row
 * 
 * This component creates a horizontal flex layout container that arranges its children
 * in a row. Perfect for creating horizontal layouts like toolbars, button groups, or
 * side-by-side content arrangements.
 */
const HStack: React.FC<HStackProps> = ({ className, ...props }) => {
  return (
    <Stack
      {...props}
      className={classNames(styles.hStack, className)}
      baseDirection="row"
    />
  )
}

export default HStack
