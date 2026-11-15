export interface TrainerStatsRepository {
  countStudents(): Promise<number>;
  countActivePrograms(): Promise<number>;
  countExercises(): Promise<number>;
}

export async function getTrainerStats(repository: TrainerStatsRepository) {
  const [totalStudents, activePrograms, totalExercises] = await Promise.all([
    repository.countStudents(),
    repository.countActivePrograms(),
    repository.countExercises(),
  ]);

  return { totalStudents, activePrograms, totalExercises };
}
