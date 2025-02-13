export function truncateDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}