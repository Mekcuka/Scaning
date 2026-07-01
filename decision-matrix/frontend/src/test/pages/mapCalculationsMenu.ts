import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Opens the map toolbar «Расчёт» dropdown. */
export async function openMapCalculationsMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Расчёт' }));
}

/** Runs «Анализ всех точек» from the calculations menu. */
export async function clickAnalyzeAllPois() {
  await openMapCalculationsMenu();
  await userEvent.click(screen.getByRole('button', { name: /Анализ всех точек/i }));
}

/** Runs «Анализ выбранной точки» from the calculations menu. */
export async function clickAnalyzeSelectedPoi() {
  await openMapCalculationsMenu();
  await userEvent.click(screen.getByRole('button', { name: /Анализ выбранной точки/i }));
}

/** Enters autoroad network build mode from the calculations menu. */
export async function clickAutoroadNetworkTool() {
  await openMapCalculationsMenu();
  await userEvent.click(screen.getByRole('button', { name: 'Сеть автодорог' }));
}
