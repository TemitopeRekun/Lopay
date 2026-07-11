/** Resolved bank account the parent should transfer into (platform or school). */
export interface BankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  isLopayEscrow: boolean;
  institutionName: string;
}
