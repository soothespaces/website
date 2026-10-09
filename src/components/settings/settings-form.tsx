"use client";

import Link from "next/link";
import { loginHref } from "@/lib/auth/paths";
import { useSettings, type SettingsPersistence } from "@/lib/settings/settings-provider";
import { ROUTES } from "@/lib/site";
import { ChoiceGroup } from "./choice-group";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90";

export function SettingsForm() {
  const { settings, ready, signedIn, persistence, update } = useSettings();
  const value = (current: string) => (ready ? current : "");

  return (
    <div className="flex flex-col gap-10">
      <StorageNotice persistence={persistence} signedIn={signedIn} />

      <ChoiceGroup
        legend="Theme"
        description="Light and dark. Same as device follows the appearance setting on your phone or computer."
        columns={3}
        value={value(settings.theme)}
        onValueChange={(theme) => {
          if (theme === "system" || theme === "light" || theme === "dark") update({ theme });
        }}
        options={[
          { value: "system", label: "Same as device" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl">Accessibility</h2>
          <p className="text-muted-foreground">
            Contrast, text size, and motion. Each one follows your device until you choose otherwise.
          </p>
        </div>

        <ChoiceGroup
          heading="h3"
          legend="Contrast"
          description="High contrast uses black and white with stronger borders. Standard uses the usual colors."
          columns={3}
          value={value(settings.contrast)}
          onValueChange={(contrast) => {
            if (contrast === "system" || contrast === "normal" || contrast === "more") {
              update({ contrast });
            }
          }}
          options={[
            { value: "system", label: "Same as device" },
            { value: "normal", label: "Standard" },
            { value: "more", label: "High contrast" },
          ]}
        />

        <ChoiceGroup
          heading="h3"
          legend="Text size"
          description="Scales the whole app. Your browser's zoom still applies on top of this."
          columns={4}
          value={value(String(settings.text))}
          onValueChange={(text) => {
            if (text === "100") update({ text: 100 });
            else if (text === "112.5") update({ text: 112.5 });
            else if (text === "125") update({ text: 125 });
            else if (text === "150") update({ text: 150 });
          }}
          options={[
            { value: "100", label: "Default", hint: "100%" },
            { value: "112.5", label: "Large", hint: "112.5%" },
            { value: "125", label: "Larger", hint: "125%" },
            { value: "150", label: "Largest", hint: "150%" },
          ]}
        />

        <ChoiceGroup
          heading="h3"
          legend="Motion"
          description="Reduce motion turns off animations in the app."
          columns={2}
          value={value(settings.motion)}
          onValueChange={(motion) => {
            if (motion === "system" || motion === "reduce") update({ motion });
          }}
          options={[
            { value: "system", label: "Same as device" },
            { value: "reduce", label: "Reduce motion" },
          ]}
        />
      </section>

      <ChoiceGroup
        legend="Default view"
        description="Which view opens first. The list is still being built, and this choice is saved for it."
        columns={2}
        value={value(settings.defaultView)}
        onValueChange={(defaultView) => {
          if (defaultView === "map" || defaultView === "list") update({ defaultView });
        }}
        options={[
          { value: "map", label: "Map" },
          { value: "list", label: "List" },
        ]}
      />
    </div>
  );
}

function StorageNotice({
  persistence,
  signedIn,
}: {
  persistence: SettingsPersistence;
  signedIn: boolean;
}) {
  if (persistence === "pending") return null;

  if (!signedIn) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
        <p>
          {persistence === "device-error"
            ? "Couldn't save on this device, so these changes apply until you reload. "
            : "These preferences are saved on this device. "}
          Sign in with your @umich.edu account to save them to your account.
        </p>
        <Link href={loginHref(ROUTES.accountPreferences)} className={primaryButton}>
          Sign in
        </Link>
      </div>
    );
  }

  if (persistence === "account") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Saved to your account.
      </p>
    );
  }

  if (persistence === "device-error") {
    return (
      <p role="alert" className="rounded-md border border-input px-4 py-3 text-sm">
        Couldn&apos;t save these preferences. They apply until you reload the page.
      </p>
    );
  }

  return (
    <p role="alert" className="rounded-md border border-input px-4 py-3 text-sm">
      Couldn&apos;t save to your account. These preferences are still saved on this device.
    </p>
  );
}
