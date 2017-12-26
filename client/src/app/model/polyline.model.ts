export class Polyline {
    public points = [];
    public color: string;
    public width: number;

    constructor(color: string, width: number) {
        this.color = color;
        this.width = width;
    }
}