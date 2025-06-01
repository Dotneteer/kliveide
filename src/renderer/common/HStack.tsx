import React from 'react'
import { FlexStack, BaseStackProps } from './FlexStack'
import styles from './HStack.module.scss'

interface HStackProps extends BaseStackProps {}

/**
 * HStack - A horizontal flex container for arranging items in a row
 * 
 * This component creates a horizontal flex layout container that arranges its children
 * in a row. Perfect for creating horizontal layouts like toolbars, button groups, or
 * side-by-side content arrangements.
 */
const HStack: React.FC<HStackProps> = (props) => {
  return (
    <FlexStack
      {...props}
      moduleStyles={styles}
      moduleClassName="hStack"
      baseDirection="row"
    />
  )
}

export default HStack
