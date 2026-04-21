import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, price, flux, config, agentType = 'generic', risk = 50, allocated = 0 } = body;

    // Simulate parsing config.yaml
    const thresholdMatch = config.match(/threshold_sigma:\s*([0-9.]+)/);
    const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.8;

    const usePaperMatch = config.match(/use_paper:\s*(true|false)/);
    const isPaper = usePaperMatch ? usePaperMatch[1] === 'true' : true;

    // Action Logic Node
    const action = flux > 0 ? 'BUY' : 'SELL';
    
    // Simulate computational processing time slightly differently per agent type
    const delayMap: Record<string, number> = { scout: 200, ghost: 100, grid: 800, hunter: 1000, sentinel: 1200, generic: 600 };
    const delayMs = delayMap[agentType] || 600;
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
      
      // Simulate realistic ROI per trade attempt (-3.5% to +6.5%)
      const randomFactor = Math.random() * 2.0 - 0.7; // Bias slightly to win
      const roi = randomFactor * 0.05; 
      
      tradePnl = Number((tradeSize * roi).toFixed(2));
      
      let liveMessage = '';
      if (!isPaper) {
        liveMessage = ` [LIVE ORDER SENT: POST /api/v3/order (Binance)]`;
      }
      
      return NextResponse.json({
        status: 'EXECUTED',
        action,
        symbol,
        price,
        pnl: tradePnl,
        isPaper,
        agent: agentType,
        message: `[${agentType.toUpperCase()} CORE] Position closed. ROI: ${(roi * 100).toFixed(2)}% | Volatility: ${Math.abs(effectiveFlux).toFixed(2)}σ${liveMessage}`
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
