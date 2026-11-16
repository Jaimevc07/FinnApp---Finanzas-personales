'use client';
// Modo solo lectura: quien solo puede ver un cuaderno ve las hojas y los montos, pero no los puede cambiar.
import { createContext, useContext } from 'react';

const SoloLectura = createContext(false);
export const ProveedorSoloLectura = SoloLectura.Provider;
export const useSoloLectura = () => useContext(SoloLectura);
