package expo.modules.rollcamgallery

import android.content.ContentValues
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Copies a print into Pictures/ROLLCAM through MediaStore. From Android 10 an
// app may add its own images there without any storage permission, so the
// gallery copy needs no prompt and no Play photo-permission declaration.
private val ALBUM = "${Environment.DIRECTORY_PICTURES}/ROLLCAM"

class RollcamGalleryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RollcamGallery")

    Constant("supported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q }

    AsyncFunction("save") { path: String, name: String, takenAt: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw CodedException("ERR_GALLERY_OLD", "Android 10 or newer only", null)
      val ctx = appContext.reactContext ?: throw CodedException("ERR_GALLERY_CONTEXT", "no context", null)
      val src = File(Uri.parse(path).path ?: path)
      if (!src.exists()) throw CodedException("ERR_GALLERY_SOURCE", "missing ${src.path}", null)
      val resolver = ctx.contentResolver
      val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      // already there from a copy whose mark didn't get written (the app was closed
      // right after): only this install's own items are visible, which is all we need
      resolver.query(
        collection,
        arrayOf(MediaStore.Images.Media._ID),
        "${MediaStore.Images.Media.DISPLAY_NAME} = ? AND ${MediaStore.Images.Media.RELATIVE_PATH} = ?",
        arrayOf(name, "$ALBUM/"),
        null,
      )?.use { c -> if (c.moveToFirst()) return@AsyncFunction android.content.ContentUris.withAppendedId(collection, c.getLong(0)).toString() }
      // the print has no EXIF, and MediaStore re-reads the taken time from EXIF when
      // the item is published (a DATE_TAKEN we set is dropped): stamp a copy first
      val stamped = File(ctx.cacheDir, "gallery-$name")
      src.copyTo(stamped, overwrite = true)
      try {
        val at = Date(takenAt.toLong())
        val tz = TimeZone.getDefault()
        val exif = ExifInterface(stamped.path)
        val stamp = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).apply { timeZone = tz }.format(at)
        exif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, stamp)
        exif.setAttribute(ExifInterface.TAG_DATETIME_DIGITIZED, stamp)
        exif.setAttribute(ExifInterface.TAG_DATETIME, stamp)
        val off = tz.getOffset(at.time) / 60000
        val offset = String.format(Locale.US, "%s%02d:%02d", if (off < 0) "-" else "+", Math.abs(off) / 60, Math.abs(off) % 60)
        exif.setAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL, offset)
        exif.setAttribute(ExifInterface.TAG_OFFSET_TIME, offset)
        exif.setAttribute(ExifInterface.TAG_SOFTWARE, "ROLLCAM")
        exif.saveAttributes()
      } catch (e: Exception) {
        // a copy without the time still beats no copy
      }
      val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, name)
        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
        put(MediaStore.Images.Media.RELATIVE_PATH, ALBUM)
        put(MediaStore.Images.Media.DATE_TAKEN, takenAt.toLong())
        put(MediaStore.Images.Media.IS_PENDING, 1)
      }
      val uri = resolver.insert(collection, values)
        ?: throw CodedException("ERR_GALLERY_INSERT", "MediaStore insert failed", null)
      try {
        resolver.openOutputStream(uri).use { out ->
          if (out == null) throw CodedException("ERR_GALLERY_WRITE", "no output stream", null)
          stamped.inputStream().use { it.copyTo(out) }
        }
        resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
      } catch (e: Exception) {
        resolver.delete(uri, null, null)
        throw e
      } finally {
        stamped.delete()
      }
      uri.toString()
    }
  }
}
