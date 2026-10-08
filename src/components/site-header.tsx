import { Suspense } from "react";
import { AccountButton, AccountButtonFallback } from "./account-button";
import { HeaderFrame } from "./header-frame";

export function SiteHeader() {
  return (
    <HeaderFrame
      account={
        <Suspense fallback={<AccountButtonFallback />}>
          <AccountButton />
        </Suspense>
      }
    />
  );
}
