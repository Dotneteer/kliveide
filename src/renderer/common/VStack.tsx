import React from 'react'
import { FlexStack, BaseStackProps } from './FlexStack'
import styles from './VStack.module.scss'

interface VStackProps extends BaseStackProps {}

/**
 * VStack - A vertical flex container for arranging items in a column
 * 
 * This component creates a vertical flex layout container that arranges its children
 * in a column. Perfect for creating vertical layouts like navigation menus, form fields,
 * or top-to-bottom content arrangements.
 */
const VStack: React.FC<VStackProps> = (props) => {
  return (
    <FlexStack
      {...props}
      moduleStyles={styles}
      moduleClassName="vStack"
      baseDirection="column"
    />
  )
}

export default VStack
