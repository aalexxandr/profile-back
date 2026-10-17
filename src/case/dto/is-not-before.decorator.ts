import { registerDecorator, ValidationArguments } from 'class-validator';

/**
 * The decorated ISO date (`YYYY-MM-DD`) must not be earlier than the date in
 * `otherProperty`. ISO dates of one format compare correctly as strings. If
 * either value is not a string, the check passes: the type rules of the
 * respective fields report that error.
 */
export function IsNotBefore(otherProperty: string) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotBefore',
      target: target.constructor,
      propertyName,
      constraints: [otherProperty],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [other] = args.constraints as [string];
          const otherValue = (args.object as Record<string, unknown>)[other];
          if (typeof value !== 'string' || typeof otherValue !== 'string') {
            return true;
          }
          return value >= otherValue;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not be earlier than ${String(args.constraints[0])}`;
        },
      },
    });
  };
}
