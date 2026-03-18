import type { ValidationError } from '@nestjs/common';

interface ValidationErrorDetail {
  field: string;
  messages: string[];
}

function collectValidationErrors(
  errors: ValidationError[],
  parentPath?: string,
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = error.constraints
      ? [
          {
            field: path,
            messages: Object.values(error.constraints),
          },
        ]
      : [];

    const childErrors = error.children?.length
      ? collectValidationErrors(error.children, path)
      : [];

    return [...ownErrors, ...childErrors];
  });
}

export function buildValidationErrorDetails(errors: ValidationError[]) {
  return collectValidationErrors(errors);
}
