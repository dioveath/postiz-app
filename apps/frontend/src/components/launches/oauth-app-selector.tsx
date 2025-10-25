'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';

interface OAuthApp {
  id: string;
  name: string;
  providerIdentifier: string;
  clientId: string;
  isDefault: boolean;
  createdAt: string;
}

export const OAuthAppSelector: FC<{
  provider: string;
  onSelect: (oauthAppId: string | null) => void;
  onCancel: () => void;
}> = ({ provider, onSelect, onCancel }) => {
  const fetch = useFetch();
  const t = useT();
  const modals = useModals();
  const [oauthApps, setOAuthApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const loadOAuthApps = useCallback(async () => {
    try {
      const response = await fetch(`/integrations/oauth-apps?provider=${provider}`);
      console.log('OAuth apps response:', response);
      if (!response.ok) {
        console.error('Failed to load OAuth apps - HTTP error:', response.status);
        setOAuthApps([]);
        return;
      }
      const text = await response.text();
      console.log('OAuth apps response text:', text);
      if (!text || text.trim() === '') {
        console.log('Empty response, using empty array');
        setOAuthApps([]);
        return;
      }
      const apps = JSON.parse(text);
      console.log('Parsed OAuth apps:', apps);
      setOAuthApps(Array.isArray(apps) ? apps : []);
    } catch (error) {
      console.error('Failed to load OAuth apps:', error);
      setOAuthApps([]);
    } finally {
      setLoading(false);
    }
  }, [fetch, provider]);

  useEffect(() => {
    loadOAuthApps();
  }, [loadOAuthApps]);

  const handleSelect = useCallback(() => {
    onSelect(selectedAppId);
  }, [selectedAppId, onSelect]);

  const handleAddNew = useCallback(() => {
    modals.openModal({
      title: `Add ${provider} OAuth App`,
      withCloseButton: true,
      children: (
        <AddOAuthApp
          provider={provider}
          onSuccess={(newAppId) => {
            modals.closeAll();
            onSelect(newAppId);
          }}
          onCancel={() => modals.closeAll()}
        />
      ),
    });
  }, [modals, provider, onSelect]);

  if (loading) {
    return (
      <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative">
        <TopTitle title={`Select ${provider} OAuth App`} />
        <div className="pt-[20px] pb-[20px] text-center">
          <div className="text-customColor18">Loading OAuth apps...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative">
      <TopTitle title={`Select ${provider} OAuth App`} />
      <button
        onClick={onCancel}
        className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
      >
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
        >
          <path
            d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>

      <div className="pt-[20px] pb-[20px]">
        <div className="text-customColor18 mb-[16px]">
          Choose an OAuth app to use for this {provider} integration:
        </div>

        {/* Default option */}
        <div className="mb-[12px]">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="oauthApp"
              value=""
              checked={selectedAppId === null}
              onChange={() => setSelectedAppId(null)}
              className="mr-[8px]"
            />
            <div className="flex flex-col">
              <span className="font-medium">Use Default OAuth App</span>
              <span className="text-sm text-customColor18">
                Use the system default OAuth credentials
              </span>
            </div>
          </label>
        </div>

        {/* Custom OAuth apps */}
        {oauthApps.map((app) => (
          <div key={app.id} className="mb-[12px]">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="oauthApp"
                value={app.id}
                checked={selectedAppId === app.id}
                onChange={() => setSelectedAppId(app.id)}
                className="mr-[8px]"
              />
              <div className="flex flex-col">
                <span className="font-medium">{app.name}</span>
                <span className="text-sm text-customColor18">
                  Client ID: {app.clientId.substring(0, 20)}...
                  {app.isDefault && ' (Default)'}
                </span>
              </div>
            </label>
          </div>
        ))}

        <div className="mt-[20px] flex gap-[12px]">
          <Button
            type="button"
            secondary
            onClick={handleAddNew}
            className="flex-1"
          >
            Add New OAuth App
          </Button>
          <Button
            type="button"
            onClick={handleSelect}
            disabled={selectedAppId === undefined}
            className="flex-1"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

// Add OAuth App component
export const AddOAuthApp: FC<{
  provider: string;
  onSuccess: (oauthAppId: string) => void;
  onCancel: () => void;
}> = ({ provider, onSuccess, onCancel }) => {
  const fetch = useFetch();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);

      const formData = new FormData(e.currentTarget);
      const data = {
        providerIdentifier: provider,
        name: formData.get('name') as string,
        clientId: formData.get('clientId') as string,
        clientSecret: formData.get('clientSecret') as string,
      };

      try {
        const response = await fetch('/integrations/oauth-apps', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          onSuccess(result.id);
        } else {
          const error = await response.json();
          alert(`Failed to create OAuth app: ${error.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Failed to create OAuth app:', error);
        alert('Failed to create OAuth app. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [fetch, provider, onSuccess]
  );

  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative">
      <TopTitle title={`Add ${provider} OAuth App`} />
      <button
        onClick={onCancel}
        className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
      >
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
        >
          <path
            d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>

      <form onSubmit={handleSubmit} className="pt-[20px] pb-[20px]">
        <div className="space-y-[16px]">
          <div>
            <label className="block text-sm font-medium text-customColor18 mb-[8px]">
              App Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="My YouTube OAuth App"
              className="w-full px-[12px] py-[8px] border border-customColor6 rounded-[4px] bg-sixth text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-customColor18 mb-[8px]">
              Client ID
            </label>
            <input
              type="text"
              name="clientId"
              required
              placeholder="Your OAuth Client ID"
              className="w-full px-[12px] py-[8px] border border-customColor6 rounded-[4px] bg-sixth text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-customColor18 mb-[8px]">
              Client Secret
            </label>
            <input
              type="password"
              name="clientSecret"
              required
              placeholder="Your OAuth Client Secret"
              className="w-full px-[12px] py-[8px] border border-customColor6 rounded-[4px] bg-sixth text-newTextColor focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-[24px] flex gap-[12px]">
          <Button
            type="button"
            secondary
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create OAuth App'}
          </Button>
        </div>
      </form>
    </div>
  );
};
