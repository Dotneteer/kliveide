export class DelayedJobs {
  private _delayedJobs = new Map<string, any>();

  public cancel(tag: string): boolean {
    const job = this._delayedJobs.get(tag);
    this._delayedJobs.delete(tag);
    if (!job) return false;
    clearTimeout(job.timeoutId);
    job.setCanceled();
    return true;
  }

  public instantlyRunAllOf(kind?: number): Promise<any> {
    const promises = [];
    const jobs = this.getJobsOfKind(kind);
    for (const job of jobs) {
      clearTimeout(job.timeoutId);
      promises.push(job.setComplete());
    }
    return Promise.allSettled(promises);
  }

  public schedule(
    delayMs: number,
    tag: string,
    kind: number,
    action: () => Promise<void>
  ): Promise<void> {
    return new Promise<void>((resolve, reject) =>{
      this._delayedJobs.get(tag)?.setCanceled();

      const setComplete = async () => {
        this._delayedJobs.delete(tag);
        try {
          await action();
          resolve();
        } catch (e) {
          reject(e);
          if (e !== "canceled")
            throw e;
        }
      };

      this._delayedJobs.set(
        tag,
        {
          timeoutId: setTimeout(setComplete, delayMs),
          setCanceled: () => reject("canceled"),
          setComplete,
          kind
        }
      );
    });
  }

  private static filter<T>(it: IterableIterator<T>, p: (T) => boolean) {
    return {
      *[Symbol.iterator]() {
        for (const v of it) {
          if (p(v)) yield v;
        }
      }
    };
  }

  private getJobsOfKind(kind?: number): any[] {
    if (kind === undefined) return [...this._delayedJobs.values()];
    return [...DelayedJobs.filter(this._delayedJobs.values(), job => job.kind === kind)];
  }
}
