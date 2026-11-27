// Part of SAASound copyright 1998-2018 Dave Hooper <dave@beermex.com>
//
// SAAAmp.cpp: implementation of the CSAAAmp class.
// This class handles Tone/Noise mixing, Envelope application and
// amplification.
//
//////////////////////////////////////////////////////////////////////

#include "SAASound.h"
#include "types.h"
#include "SAANoise.h"
#include "SAAEnv.h"
#include "SAAFreq.h"
#include "SAAAmp.h"
#include "defns.h"

//////////////////////////////////////////////////////////////////////
// Construction/Destruction
//////////////////////////////////////////////////////////////////////

CSAAAmp::CSAAAmp(CSAAFreq * const ToneGenerator, const CSAANoise * const NoiseGenerator, const CSAAEnv * const EnvGenerator)
:
m_pcConnectedToneGenerator(ToneGenerator),
m_pcConnectedNoiseGenerator(NoiseGenerator),
m_pcConnectedEnvGenerator(EnvGenerator),
m_bUseEnvelope(EnvGenerator != NULL)
{
	leftlevel = 0;
	leftlevel_div2 = 0;
	rightlevel = 0;
	rightlevel_div2 = 0;
	m_nMixMode = 0;
	m_bMute=true;
	m_bSync = false;
	m_nOutputIntermediate=0;
	last_level_byte=0;
	SetAmpLevel(0x00);

}

CSAAAmp::~CSAAAmp()
{
	// Nothing to do
}

void CSAAAmp::SetAmpLevel(BYTE level_byte)
{
	// if level unchanged since last call then do nothing
	if (level_byte != last_level_byte)
	{
		last_level_byte = level_byte;
		leftlevel = level_byte & 0x0f;
		leftlevel_div2 = leftlevel >> 1;
	
		rightlevel = (level_byte >> 4) & 0x0f;
		rightlevel_div2 = rightlevel >> 1;
	}

}

void CSAAAmp::SetToneMixer(BYTE bEnabled)
{
	if (bEnabled == 0)
	{
		// clear mixer bit
		m_nMixMode &= ~(0x01);
	}
	else
	{
		// set mixer bit
		m_nMixMode |= 0x01;
	}
}

void CSAAAmp::SetNoiseMixer(BYTE bEnabled)
{
	if (bEnabled == 0)
	{
		m_nMixMode &= ~(0x02);
	}
	else
	{
		m_nMixMode |= 0x02;
	}
}

void CSAAAmp::Mute(bool bMute)
{
	// m_bMute refers to the GLOBAL mute setting (register 28 bit 0)
	// NOT the per-channel mixer settings !!
	m_bMute = bMute;
}

void CSAAAmp::Sync(bool bSync)
{
	// m_bSync refers to the GLOBAL sync setting (register 28 bit 1)
	m_bSync = bSync;
}

void CSAAAmp::Tick(void)
{
	// updates m_nOutputIntermediate to 0, 1 or 2
	//

	// connected oscillator always ticks (this isn't really connected to the amp)
	int level = m_pcConnectedToneGenerator->Tick();

	switch (m_nMixMode)
	{
		case 0:
			// no tone or noise for this channel
			m_nOutputIntermediate = 0;
			break;
		case 1:
			// tone only for this channel
			m_nOutputIntermediate = level * 2;
			// NOTE: ConnectedToneGenerator returns either 0 or 1
			break;
		case 2:
			// noise only for this channel
			m_nOutputIntermediate = m_pcConnectedNoiseGenerator->Level() * 2;
			// NOTE: ConnectedNoiseGenerator()->Level() returns either 0 or 1
			break;
		case 3:
			// tone+noise for this channel ... mixing algorithm :
			//  tone   noise   output
			//   0       0       0
			//   1       0       2
			//   0       1       0
			//   1       1       1
			// = 2 * tone - 1 * (tone & noise)
			// = tone * (2 - noise)
			m_nOutputIntermediate = level * (2 - m_pcConnectedNoiseGenerator->Level());
			break;
	}
	// intermediate is between 0 and 2
}

inline unsigned int CSAAAmp::EffectiveAmplitude(unsigned int amp_div2, unsigned int env) const
{
	// Return the effective amplitude of the low-pass-filtered result of the logical
	// AND of the amplitude PDM and envelope PDM patterns.  This is a more accurate
	// evaluation of the SAA than simply returning amp * env , based on how the SAA
	// implements pulse-density modulation.
	static const unsigned int pdm[8][16] = {
	{0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
	{0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8},
	{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15},
	{0,2,3,5,6,8,9,11,12,14,15,17,18,20,21,23},
	{0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30},
	{0,3,5,8,10,13,15,18,20,23,25,28,30,33,35,38},
	{0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45},
	{0,4,7,11,14,18,21,25,28,32,35,39,42,46,49,53},
	};

	return(pdm[amp_div2][env] * 4);
}

void CSAAAmp::TickAndOutputStereo(unsigned int & left, unsigned int & right)
{
	// This returns a value between 0 and 480 inclusive.
	// This represents the full dynamic range of one output mixer (tone, or noise+tone, at full volume,
	// without envelopes enabled).  Note that, with envelopes enabled, the actual dynamic range
	// is reduced on-chip to just over 88% of this (424), so the "loudest" output requires disabling envs.
	// NB for 6 channels at full volume, with simple additive mixing, you would see a combined
	// output of 2880, and a multiplier of 11 (=31680) fits comfortably within 16-bit signed output range.

	if (m_bSync)
	{
		// TODO check this
		left = right = 0;
		return;
	}

	// first, do the Tick:
	Tick();
	
	// now calculate the returned amplitude for this sample:
	////////////////////////////////////////////////////////

	if (m_bMute)
	{
		left = right = 0;
	}
	else if (m_bUseEnvelope && m_pcConnectedEnvGenerator->IsActive())
	{
		left = EffectiveAmplitude(leftlevel_div2, m_pcConnectedEnvGenerator->LeftLevel()) * (2 - m_nOutputIntermediate);
		right = EffectiveAmplitude(rightlevel_div2, m_pcConnectedEnvGenerator->RightLevel()) * (2 - m_nOutputIntermediate);
	}
	else
	{
		left = leftlevel * m_nOutputIntermediate * 16;
		right = rightlevel * m_nOutputIntermediate * 16;
	}
}
