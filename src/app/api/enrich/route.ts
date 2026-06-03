import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { enrichCompany } from '@/lib/enrichment';

export async function POST(request: Request) {
  try {
    const { companyId } = await request.json();

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Fetch company name
    const { data: company, error: fetchError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      return NextResponse.json(
        { error: fetchError?.message || 'Company not found' },
        { status: 404 }
      );
    }

    // Call enrichment API
    const enrichment = await enrichCompany(company.name);

    // Update company in database
    const { data: updatedCompany, error: updateError } = await supabase
      .from('companies')
      .update({
        domain: enrichment.domain,
        logo_url: enrichment.logoUrl,
        enrichment_source: enrichment.source,
        enriched_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[EnrichAPI] Server error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
