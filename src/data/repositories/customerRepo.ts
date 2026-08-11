/** Customer persistence. See docs/02-data-model.md. */

import { db, newId, nowIso } from '../db';
import type { Customer, Id } from '@/domain/types';

export type NewCustomer = Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'balancePaise'> & {
  balancePaise?: number;
};

export async function listCustomers(): Promise<Customer[]> {
  const all = await db.customers.toArray();
  return all.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomer(id: Id): Promise<Customer | undefined> {
  return db.customers.get(id);
}

/** Phone is how a shopkeeper actually looks someone up. */
export async function findByPhone(phone: string): Promise<Customer | undefined> {
  const normalised = normalisePhone(phone);
  const hit = await db.customers.where('phone').equals(normalised).first();
  return hit?.deletedAt ? undefined : hit;
}

export async function searchCustomers(term: string): Promise<Customer[]> {
  const q = term.trim().toLowerCase();
  if (!q) return listCustomers();
  const all = await listCustomers();
  return all.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
}

export async function createCustomer(input: NewCustomer): Promise<Customer> {
  const now = nowIso();
  const customer: Customer = {
    ...input,
    phone: normalisePhone(input.phone),
    balancePaise: input.balancePaise ?? 0,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.customers.add(customer);
  return customer;
}

export async function updateCustomer(id: Id, patch: Partial<Customer>): Promise<void> {
  const next: Partial<Customer> = { ...patch, updatedAt: nowIso() };
  if (patch.phone !== undefined) next.phone = normalisePhone(patch.phone);
  await db.customers.update(id, next);
}

/**
 * Soft delete, and refused while money is owed — deleting a customer with an
 * outstanding balance would silently erase a debt.
 */
export async function deleteCustomer(id: Id): Promise<void> {
  const customer = await db.customers.get(id);
  if (!customer) return;
  if (customer.balancePaise !== 0) {
    throw new Error('Cannot remove a customer who still has a credit balance');
  }
  await db.customers.update(id, { deletedAt: nowIso(), updatedAt: nowIso() });
}

/** Strip +91 / 0 prefixes and punctuation down to the 10-digit local number. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** wa.me needs the country code; the UI stores and shows the local number. */
export const toWhatsAppNumber = (phone: string): string => `91${normalisePhone(phone)}`;

export const isValidIndianMobile = (phone: string): boolean =>
  /^[6-9]\d{9}$/.test(normalisePhone(phone));
