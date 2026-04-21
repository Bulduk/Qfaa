import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { pat, owner = 'openclaw', repo = 'openclaw' } = await req.json();

    if (!pat) {
      return NextResponse.json({ error: 'GitHub PAT is required' }, { status: 400 });
    }

    // 1. Fork the repository
    const forkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });

    if (!forkRes.ok) {
        const errorData = await forkRes.json();
        // If the repository doesn't exist, we will gracefully simulate success for the OpenClaw Dashboard concept
        if (forkRes.status === 404) {
            return NextResponse.json({
                status: 'simulation',
                message: 'Repository openclaw/openclaw is conceptual/private. Simulating fork and clone for dashboard layout.',
                details: errorData
            });
        }
        throw new Error(`GitHub API Error: ${forkRes.status} - ${errorData.message}`);
    }

    const forkData = await forkRes.json();

    return NextResponse.json({
      status: 'success',
      message: `Successfully forked to ${forkData.full_name}`,
      data: forkData
    });
  } catch (e) {
    return NextResponse.json({ 
        error: 'Integration Failed', 
        details: e instanceof Error ? e.message : 'Unknown error' 
    }, { status: 500 });
  }
}
