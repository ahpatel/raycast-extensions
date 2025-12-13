import { Action, ActionPanel, Form, getPreferenceValues, showToast, Toast, useNavigation } from "@raycast/api";
import { Fragment, useEffect, useState } from "react";

interface Preferences {
  domain: string;
  apiToken: string;
  limit: string;
}

interface Organization {
  id: number;
  name: string;
}

interface EmailEntry {
  value: string;
  label: string;
}

interface PhoneEntry {
  value: string;
  label: string;
}

interface ContactFormValues {
  name: string;
  organizationId: string;
  jobTitle: string;
}

interface AddContactProps {
  prefillName?: string;
}

export default function AddContact({ prefillName }: AddContactProps = {}) {
  const { pop } = useNavigation();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emails, setEmails] = useState<EmailEntry[]>([{ value: "", label: "work" }]);
  const [phones, setPhones] = useState<PhoneEntry[]>([{ value: "", label: "work" }]);

  useEffect(() => {
    void fetchOrganizations();
  }, []);

  async function fetchOrganizations() {
    const preferences = getPreferenceValues<Preferences>();

    try {
      const url = new URL(`https://${preferences.domain}/api/v1/organizations`);
      url.searchParams.set("api_token", preferences.apiToken);
      url.searchParams.set("limit", "500");
      url.searchParams.set("sort", "name ASC");

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.statusText}`);
      }

      const data = (await response.json()) as { data?: Organization[] | null };
      setOrganizations(data.data || []);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load organizations",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoadingOrgs(false);
    }
  }

  const emailTypes = [
    { value: "work", label: "Work" },
    { value: "home", label: "Home" },
    { value: "other", label: "Other" },
  ];

  const phoneTypes = [
    { value: "work", label: "Work" },
    { value: "mobile", label: "Mobile" },
    { value: "home", label: "Home" },
    { value: "other", label: "Other" },
  ];

  function addEmail() {
    setEmails((prevEmails: EmailEntry[]) => [...prevEmails, { value: "", label: "work" }]);
  }

  function updateEmail(index: number, field: keyof EmailEntry, value: string) {
    setEmails((prevEmails: EmailEntry[]) => {
      const updated = [...prevEmails];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addPhone() {
    setPhones((prev: PhoneEntry[]) => [...prev, { value: "", label: "work" }]);
  }

  function updatePhone(index: number, field: keyof PhoneEntry, value: string) {
    setPhones((prev: PhoneEntry[]) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleSubmit(values: ContactFormValues) {
    const name = (values.name || "").trim();
    if (!name) {
      await showToast({ style: Toast.Style.Failure, title: "Name is required" });
      return;
    }

    const preferences = getPreferenceValues<Preferences>();

    try {
      setIsSubmitting(true);

      const url = new URL(`https://${preferences.domain}/api/v1/persons`);
      url.searchParams.set("api_token", preferences.apiToken);

      const body: Record<string, unknown> = {
        name,
      };

      const validEmails = emails.filter((email) => email.value.trim());
      if (validEmails.length > 0) {
        body.email = validEmails.map((email, index) => ({
          value: email.value.trim(),
          label: email.label,
          primary: index === 0,
        }));
      }

      const validPhones = phones.filter((phone) => phone.value.trim());
      if (validPhones.length > 0) {
        body.phone = validPhones.map((phone, index) => ({
          value: phone.value.trim(),
          label: phone.label,
          primary: index === 0,
        }));
      }

      const jobTitle = (values.jobTitle || "").trim();
      if (jobTitle) {
        body.job_title = jobTitle;
      }

      const orgId = (values.organizationId || "").trim();
      if (orgId) {
        body.org_id = Number.parseInt(orgId, 10);
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}) as unknown)) as { error?: string };
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as { data?: { id: number; name: string } };

      await showToast({
        style: Toast.Style.Success,
        title: "Contact added successfully",
        message: result.data?.name
          ? `${result.data.name} has been added to Pipedrive`
          : "Contact has been added to Pipedrive",
      });

      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add contact",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isLoadingOrgs || isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Add Contact"
            onSubmit={handleSubmit}
            icon="👤"
            shortcut={{ modifiers: ["cmd"], key: "enter" }}
          />
          <ActionPanel.Section>
            <Action title="Add Email" icon="📧" onAction={addEmail} shortcut={{ modifiers: ["cmd"], key: "e" }} />
            <Action title="Add Phone" icon="📞" onAction={addPhone} shortcut={{ modifiers: ["cmd"], key: "p" }} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Enter contact name"
        info="Full name of the contact (required)"
        defaultValue={prefillName || ""}
      />

      <Form.Dropdown
        id="organizationId"
        title="Organization"
        placeholder="Select organization (optional)"
        info="Choose an existing organization or leave blank"
        isLoading={isLoadingOrgs}
      >
        <Form.Dropdown.Item value="" title="No Organization" />
        {organizations.map((org: Organization) => (
          <Form.Dropdown.Item key={org.id} value={org.id.toString()} title={org.name} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      {emails.map((email: EmailEntry, index: number) => (
        <Fragment key={`email-${index}`}>
          <Form.TextField
            id={`email-${index}`}
            title={index === 0 ? "Email" : `Email ${index + 1}`}
            placeholder="Enter email address"
            value={email.value}
            onChange={(value: string) => updateEmail(index, "value", value)}
          />
          <Form.Dropdown
            id={`email-type-${index}`}
            title={index === 0 ? "Email Type" : `Email ${index + 1} Type`}
            value={email.label}
            onChange={(value: string) => updateEmail(index, "label", value)}
          >
            {emailTypes.map((type) => (
              <Form.Dropdown.Item key={type.value} value={type.value} title={type.label} />
            ))}
          </Form.Dropdown>
        </Fragment>
      ))}

      <Form.Separator />

      {phones.map((phone: PhoneEntry, index: number) => (
        <Fragment key={`phone-${index}`}>
          <Form.TextField
            id={`phone-${index}`}
            title={index === 0 ? "Phone" : `Phone ${index + 1}`}
            placeholder="Enter phone number"
            value={phone.value}
            onChange={(value: string) => updatePhone(index, "value", value)}
          />
          <Form.Dropdown
            id={`phone-type-${index}`}
            title={index === 0 ? "Phone Type" : `Phone ${index + 1} Type`}
            value={phone.label}
            onChange={(value: string) => updatePhone(index, "label", value)}
          >
            {phoneTypes.map((type) => (
              <Form.Dropdown.Item key={type.value} value={type.value} title={type.label} />
            ))}
          </Form.Dropdown>
        </Fragment>
      ))}

      <Form.Separator />

      <Form.TextField
        id="jobTitle"
        title="Job Title"
        placeholder="Enter job title"
        info="Contact's job title or position"
      />
    </Form>
  );
}
