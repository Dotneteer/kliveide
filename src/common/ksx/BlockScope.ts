/**
 * Respresent a block scope
 */
export type BlockScope = {
  // --- Block-scoped variable values
  vars: Record<string, any>;

  // --- Block-scopes const values
  constVars?: Set<string>;

  // --- Optional return value of an expression
  returnValue?: any;
};

/**
 * Represents a redirect information
 */
export type RedirectInfo = {
  valueScope: any;
  valueIndex: string | number;
};
