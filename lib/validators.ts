import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import intakeSchema from '@pinguis/contracts/schemas/intake.schema.json';

const ajv = addFormats(new Ajv({ allErrors: true, strict: true }));

export function assertValidIntake(data: unknown) {
  if (!ajv.validate(intakeSchema as unknown as object, data)) {
    throw new Error(JSON.stringify(ajv.errors ?? []));
  }
}


