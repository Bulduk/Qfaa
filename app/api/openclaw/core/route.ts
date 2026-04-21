import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, price, flux, config, agentType = 'generic', risk = 50, allocated = 0, swarmActive = false, swarmEngine = '' } = body;

    // Simulate parsing config.yaml
    const thresholdMatch = config.match(/threshold_sigma:\s*([0-9.]+)/);
    const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.8;

    const usePaperMatch = config.match(/use_paper:\s*(true|false)/);
    const isPaper = usePaperMatch ? usePaperMatch[1] === 'true' : true;

    // Action Logic Node
    const action = flux > 0 ? 'BUY' : 'SELL';
    
    // Simulate computational processing time slightly differently per agent type
    const delayMap: Record<string, number> = { scout: 200, ghost: 100, grid: 800, hunter: 1000, sentinel: 1200, generic: 600 };
    // Swarm engines take longer due to multiple consensus nodes
    const delayMs = (delayMap[agentType] || 600) + (swarmActive ? 500 : 0);
    await new Promise(res => setTimeout(res, delayMs));

    // Agent-specific logic tweaks
    let effectiveFlux = flux;
    if (agentType === 'scout') effectiveFlux = flux * 1.5; 
    else if (agentType === 'ghost') effectiveFlux = flux * 2.0;

    // Determine Trade Outcome
    let tradePnl = 0;
    if (Math.abs(effectiveFlux) >= threshold) {
      // Predictly Engine: Trade size strictly isolated to vault * risk map
      const tradeSize = allocated * (risk / 100);
      
      // Calculate Win Probability Bias
      // Normal: -0.7 to 1.3
      let minBias = -0.7;
      let maxBias = 2.0;
      let winMsg = `ROI`;

      if (swarmActive) {
        if (swarmEngine === 'MiroFish') {
          // Mirofish Swarm (Scalping): High frequency, precise micro-wins.
          minBias = -0.3; // Much less likely to lose big
          maxBias = 1.6;  // Consistent small to medium wins
          winMsg = `[MiroFish Consensus: 8/10 Nodes] ROI`;
        } else if (swarmEngine === 'BettaFish') {
          // BettaFish Swarm (Trend): Aggressive momentum riding.
          minBias = -0.5;
          maxBias = 2.5; // Has huge potential wins
          winMsg = `[BettaFish Consensus: 4/5 Nodes] ROI`;
        }
      }

      // Simulate realistic ROI per trade attempt
      const randomFactor = Math.random() * maxBias + minBias; 
      const roi = randomFactor * 0.05; 
      
      tradePnl = Number((tradeSize * roi).toFixed(2));
      
      let liveMessage = '';
      if (!isPaper) {
        liveMessage = ` [LIVE ORDER SENT]`;
      }
      
      return NextResponse.json({
        status: 'EXECUTED',
        action,
        symbol,
        price,
        pnl: tradePnl,
        isPaper,
        agent: agentType,
        message: `[${agentType.toUpperCase()} CORE] Position closed. ${winMsg}: ${(roi * 100).toFixed(2)}% | Volatility: ${Math.abs(effectiveFlux).toFixed(2)}σ${liveMessage}`
      });
    } else {
       return NextResponse.json({
        status: 'DROPPED',
        agent: agentType,
        message: `[${agentType.toUpperCase()} CORE] Signal (${flux.toFixed(2)}σ) did not meet execution threshold.`
      });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Kernel Panic', details: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
