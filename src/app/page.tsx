'use client';



import { useEffect, useState } from 'react';

import { AppLinkButton, PageCard, PageContent, PageShell } from '@/components/PageShell';



export default function HomePage() {

  const [hasActive, setHasActive] = useState<boolean>(false);



  useEffect(() => {

    let ignore = false;

    (async () => {

      try {

        const res = await fetch(`/api/tournaments/active?t=${Date.now()}`, { cache: 'no-store' });

        if (!ignore && res.ok) {

          const data = await res.json();

          setHasActive(!!data?.active);

        }

      } catch {}

    })();

    return () => { ignore = true; };

  }, []);



  return (

    <PageShell centered mobileOnly>

      <PageCard className="w-[92%] mb-4">

        <PageContent>

          <div className="page-title-block mb-8">

            <h1 className="text-2xl font-bold text-gray-800">Thursday Mixed</h1>

          </div>



          <div className="space-y-4">

            {hasActive && <div className="app-alert-warning">A tournament is already in progress</div>}

            {!hasActive && (

              <AppLinkButton href="/create-tournament" variant="success">

                Create New Tournament

              </AppLinkButton>

            )}

            {hasActive && (

              <AppLinkButton href="/join-tournament" variant="success">

                Join Tournament

              </AppLinkButton>

            )}

          </div>

        </PageContent>

      </PageCard>



      <PageCard className="w-[92%]">

        <PageContent>

          <div className="space-y-3">

            <AppLinkButton href="/tournament-results">

              View Tournament Results

            </AppLinkButton>

            <AppLinkButton href="/analytics">

              Advanced Analytics

            </AppLinkButton>

            <AppLinkButton href="/partnership-stats">

              Partnership Statistics

            </AppLinkButton>

          </div>

        </PageContent>

      </PageCard>



      <p className="mt-6 text-white text-xs opacity-75 text-center">Version 1.1</p>

    </PageShell>

  );

}


