import { AnalysisResult, WebSearchThreat } from './geminiService';

export interface ThreatScore {
  score: number; // 0-100 (0 = safe, 100 = critical threat)
  label: 'Safe' | 'Low' | 'Moderate' | 'High' | 'Critical';
  color: string;
  description: string;
}

export interface IdentityHealth {
  overallScore: number; // 0-100 (100 = perfect health, 0 = critical risk)
  threatIndex: number; // 0-100 (0 = no threats, 100 = maximum threat)
  status: 'Protected' | 'Monitored' | 'At Risk' | 'Critical';
  factors: {
    label: string;
    score: number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
}

export const threatScoringService = {
  /**
   * Calculates a score for a single media analysis result.
   */
  calculateMediaScore(result: AnalysisResult): ThreatScore {
    let score = 0;
    
    if (result.isAI) {
      // Base score for AI detection
      score = result.confidence * 100;
      
      // Adjust based on threat level
      if (result.threatLevel === 'high') score = Math.max(score, 85);
      if (result.threatLevel === 'medium') score = Math.max(score, 50);
    } else {
      // Even if not AI, low confidence might mean "uncertain"
      if (result.confidence < 0.5) {
        score = (0.5 - result.confidence) * 40;
      }
    }

    return this.getThreatDetails(score);
  },

  /**
   * Calculates the overall identity health based on web threats and recent analyses.
   */
  calculateIdentityHealth(threats: WebSearchThreat[], recentAnalyses: AnalysisResult[]): IdentityHealth {
    let threatIndex = 0;
    const factors: IdentityHealth['factors'] = [];

    // Factor 1: Web Threats
    if (threats.length > 0) {
      const avgRisk = threats.reduce((acc, t) => acc + (t.riskScore * (t.confidenceScore / 100)), 0) / threats.length;
      const countImpact = Math.min(threats.length * 5, 30); // Up to 30 points impact from quantity
      const webThreatScore = Math.min(avgRisk + countImpact, 100);
      
      threatIndex += webThreatScore * 0.6; // Web threats are 60% of the index
      
      factors.push({
        label: 'Web Presence Risk',
        score: Math.round(webThreatScore),
        impact: webThreatScore > 40 ? 'negative' : webThreatScore > 15 ? 'neutral' : 'positive'
      });
    } else {
      factors.push({
        label: 'Web Presence Risk',
        score: 0,
        impact: 'positive'
      });
    }

    // Factor 2: Recent Media Integrity
    if (recentAnalyses.length > 0) {
      const aiCount = recentAnalyses.filter(a => a.isAI).length;
      const integrityImpact = (aiCount / recentAnalyses.length) * 100;
      
      threatIndex += integrityImpact * 0.4; // Media integrity is 40% of the index
      
      factors.push({
        label: 'Media Integrity',
        score: Math.round(integrityImpact),
        impact: integrityImpact > 30 ? 'negative' : integrityImpact > 10 ? 'neutral' : 'positive'
      });
    } else {
      factors.push({
        label: 'Media Integrity',
        score: 0,
        impact: 'neutral'
      });
    }

    const overallScore = Math.max(0, 100 - threatIndex);
    
    let status: IdentityHealth['status'] = 'Protected';
    if (overallScore < 40) status = 'Critical';
    else if (overallScore < 70) status = 'At Risk';
    else if (overallScore < 90) status = 'Monitored';

    return {
      overallScore: Math.round(overallScore),
      threatIndex: Math.round(threatIndex),
      status,
      factors
    };
  },

  getThreatDetails(score: number): ThreatScore {
    if (score >= 85) {
      return {
        score,
        label: 'Critical',
        color: 'text-red-500',
        description: 'High probability of malicious synthetic manipulation detected.'
      };
    }
    if (score >= 60) {
      return {
        score,
        label: 'High',
        color: 'text-orange-500',
        description: 'Significant indicators of AI generation or manipulation found.'
      };
    }
    if (score >= 30) {
      return {
        score,
        label: 'Moderate',
        color: 'text-amber-500',
        description: 'Some synthetic patterns detected. Exercise caution.'
      };
    }
    if (score >= 10) {
      return {
        score,
        label: 'Low',
        color: 'text-blue-500',
        description: 'Minor inconsistencies found, likely authentic but requires review.'
      };
    }
    return {
      score,
      label: 'Safe',
      color: 'text-emerald-500',
      description: 'Media appears authentic with no significant synthetic markers.'
    };
  }
};
