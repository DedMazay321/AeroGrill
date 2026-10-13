package ru.aerogrill.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Срабатывает по окончании таймера и показывает уведомление, если приложение не на экране. */
public class TimerReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "timer";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        // Когда приложение открыто, оно само подаёт сигнал и показывает окно
        if (MainActivity.foreground) return;

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(CHANNEL, ctx.getString(R.string.timer_channel), NotificationManager.IMPORTANCE_HIGH);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
        nm.createNotificationChannel(ch);

        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_timer)
                .setContentTitle(ctx.getString(R.string.timer_done))
                .setContentText(intent.getStringExtra("label"))
                .setCategory(Notification.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(1, n);
    }
}
