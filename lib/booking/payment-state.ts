import type { Payment } from './types';
export function paymentLabel(payment: Payment): string {
  if (payment.capturedMinor > 0) {
    if (payment.refundedMinor >= payment.capturedMinor)
      return 'Beløpet er refundert';
    if (payment.refundedMinor > 0) return 'Delvis refundert';
    return payment.capturedMinor >= payment.amountMinor
      ? 'Betalt'
      : 'Delvis betalt';
  }
  if (payment.authorizedMinor > payment.cancelledMinor)
    return 'Beløpet er reservert – ikke belastet';
  if (payment.cancelledMinor > 0) return 'Reservasjonen er frigitt';
  if (payment.state === 'EXPIRED') return 'Betalingslenken har utløpt';
  if (['ABORTED', 'TERMINATED'].includes(payment.state))
    return 'Betalingen ble avbrutt';
  if (payment.state === 'CREATED') return 'Venter på bekreftelse hos Vipps';
  return 'Betalingsresultatet er ikke avklart ennå';
}
export function canStartPayment(payment: Payment | null): boolean {
  if (!payment) return true;
  if (
    payment.capturedMinor > 0 ||
    payment.refundedMinor > 0 ||
    payment.authorizedMinor > payment.cancelledMinor
  )
    return false;
  return ['INITIATING', 'CREATED', 'EXPIRED', 'ABORTED', 'TERMINATED'].includes(
    payment.state,
  );
}
export function canCapture(payment: Payment): boolean {
  return (
    payment.state === 'AUTHORIZED' &&
    payment.authorizedMinor > payment.capturedMinor + payment.cancelledMinor
  );
}
export function canRelease(payment: Payment): boolean {
  return payment.state === 'CREATED' || canCapture(payment);
}
