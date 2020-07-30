/**
 * Tests if a HTML node is the descendant of another node
 * @param parent Parent node
 * @param child child node
 */
export function isDescendant(parent: Node, child: Node): boolean {
    let node = child.parentNode;
    while (node != null) {
      if (node == parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }
  