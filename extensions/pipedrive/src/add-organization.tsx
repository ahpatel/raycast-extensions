import { Action, ActionPanel, Form, getPreferenceValues, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";

interface Preferences {
  domain: string;
  apiToken: string;
  limit: string;
}

interface AddOrganizationProps {
  prefillName?: string;
}

export default function AddOrganization({ prefillName }: AddOrganizationProps = {}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: { name: string; note?: string }) {
    const name = (values.name || "").trim();
    if (!name) {
      await showToast({ style: Toast.Style.Failure, title: "Organization name is required" });
      return;
    }

    const preferences = getPreferenceValues<Preferences>();

    try {
      setIsSubmitting(true);

      const url = new URL(`https://${preferences.domain}/api/v1/organizations`);
      url.searchParams.set("api_token", preferences.apiToken);

      const body: Record<string, unknown> = { name };
      const note = (values.note || "").trim();
      if (note) {
        body.note = note;
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}) as unknown)) as { error?: string };
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as { data?: { id: number; name: string } };

      await showToast({
        style: Toast.Style.Success,
        title: "Organization created",
        message: result.data?.name
          ? `${result.data.name} has been added to Pipedrive`
          : "Organization has been added to Pipedrive",
      });

      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create organization",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Organization" onSubmit={handleSubmit} icon="🏢" />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Organization Name"
        placeholder="Enter organization name"
        defaultValue={prefillName || ""}
      />
      <Form.TextArea id="note" title="Note" placeholder="Optional note" />
    </Form>
  );
}
