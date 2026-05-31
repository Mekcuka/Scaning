import '@testing-library/jest-dom/vitest';

if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock';
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => undefined;
}
