/**
 * Represents frame statistics about the last running frame
 */
export type FrameStats = {
    /**
     * Number of frames rendered since last cold start
     */
    frameCount: number;
    
    /**
     * Time required for the last CPU frame in milliseconds
     */
    lastCpuFrameTimeInMs: number;
    
    /**
     * Average CPU frame time since last cold start in milliseconds
     */
    avgCpuFrameTimeInMs: number;
    
    /**
     * Time required to render the last frame in milliseconds
     */
    lastFrameTimeInMs: number;
    
    /**
     * Average time to render the frames since last cold start in milliseconds
     */
    avgFrameTimeInMs: number;
}